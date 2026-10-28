import type { PrismaClient } from "@/generated/prisma/client";
import { priceCart, type CatalogProduct } from "@/lib/combos";
import { fromCents, toCents } from "@/lib/money";
import { paymentLabel, type ReceiptData } from "@/lib/receipt";

import { DomainError } from "./errors";
import { createOrderSchema, orderStatusSchema, type CreateOrderInput } from "./schemas";

/** Status de origem aceitos para cada status de destino (RF-08). READY -> PENDING desfaz um toque errado. */
const TRANSITIONS = {
  PENDING: ["READY"],
  READY: ["PENDING"],
  DELIVERED: ["PENDING", "READY"],
} as const;

/**
 * Cria o pedido no evento aberto (RF-04 a RF-09, RF-12): precifica no servidor com combos
 * inteligentes, baixa o estoque de forma atômica (inclusive reservas) e numera por evento.
 */
export async function createOrder(db: PrismaClient, rawInput: CreateOrderInput, createdById?: string) {
  const input = createOrderSchema.parse(rawInput);

  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { status: "OPEN" }, select: { id: true } });
    if (!event) throw new DomainError("Nenhum evento aberto. Abra um evento para vender.");

    const productIds = [...new Set(input.lines.map((line) => line.productId))].sort();
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { eventMenu: { where: { eventId: event.id } } },
    });

    const catalog = new Map<string, CatalogProduct>();
    for (const product of products) {
      const menuItem = product.eventMenu[0];
      if (product.category === "SNACK" && (!menuItem || menuItem.soldOut)) {
        throw new DomainError(`${product.name} não está disponível no cardápio de hoje.`);
      }
      catalog.set(product.id, {
        id: product.id,
        name: product.name,
        category: product.category,
        priceCents: toCents(product.price),
      });
    }
    if (catalog.size !== productIds.length) throw new DomainError("Um dos produtos não está mais disponível.");

    const combos = await tx.combo.findMany({ where: { active: true }, include: { options: true } });
    const priced = priceCart(
      input.lines,
      catalog,
      combos.map((combo) => ({
        id: combo.id,
        name: combo.name,
        priceCents: toCents(combo.price),
        optionIds: new Set(combo.options.map((option) => option.productId)),
      })),
    );

    if (
      input.paymentMethod === "CASH" &&
      input.amountReceivedCents !== undefined &&
      input.amountReceivedCents < priced.totalCents
    ) {
      throw new DomainError("Valor recebido menor que o total do pedido.");
    }

    // Baixa de estoque atômica em ordem determinística (evita deadlock entre caixas).
    const quantities = new Map<string, number>();
    for (const line of input.lines) {
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
    }
    const stockMovements: { productId: string; eventId: string; type: "SALE"; quantity: number; createdById?: string }[] = [];
    for (const product of products.sort((a, b) => a.id.localeCompare(b.id))) {
      if (product.stockControl !== "COUNTABLE") continue;
      const quantity = quantities.get(product.id)!;
      const { count } = await tx.product.updateMany({
        where: { id: product.id, stockQuantity: { gte: quantity } },
        data: { stockQuantity: { decrement: quantity } },
      });
      if (count === 0) {
        throw new DomainError(`Estoque insuficiente de ${product.name} (restam ${product.stockQuantity ?? 0}).`);
      }
      stockMovements.push({ productId: product.id, eventId: event.id, type: "SALE", quantity: -quantity, createdById });
    }

    const { orderSequence } = await tx.event.update({
      where: { id: event.id },
      data: { orderSequence: { increment: 1 } },
      select: { orderSequence: true },
    });

    const paid = input.paymentMethod !== "PAY_LATER";
    return tx.order.create({
      data: {
        eventId: event.id,
        number: orderSequence,
        customerName: input.customerName,
        isReservation: input.isReservation,
        notes: input.notes || null,
        total: fromCents(priced.totalCents),
        paymentMethod: input.paymentMethod,
        paymentStatus: paid ? "PAID" : "PENDING",
        paidAt: paid ? new Date() : null,
        amountReceived: input.amountReceivedCents === undefined ? null : fromCents(input.amountReceivedCents),
        createdById,
        items: {
          create: priced.items.map((item) =>
            item.kind === "COMBO"
              ? {
                  kind: "COMBO" as const,
                  comboId: item.comboId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: fromCents(item.unitPriceCents),
                  components: { create: item.components },
                }
              : {
                  kind: "PRODUCT" as const,
                  productId: item.productId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: fromCents(item.unitPriceCents),
                },
          ),
        },
        stockMovements: { create: stockMovements },
      },
      select: { id: true, number: true },
    });
  });
}

export async function setOrderStatus(db: PrismaClient, rawInput: { orderId: string; status: string }) {
  const { orderId, status } = orderStatusSchema.parse(rawInput);
  const { count } = await db.order.updateMany({
    where: { id: orderId, status: { in: [...TRANSITIONS[status]] } },
    data: { status },
  });
  if (count === 0) throw new DomainError("Não é possível alterar o status deste pedido.");
}

/** Cancela o pedido e devolve ao estoque tudo o que foi baixado na venda (RF-09). */
export async function cancelOrder(db: PrismaClient, orderId: string, createdById?: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["AWAITING_CONFIRMATION", "PENDING", "READY"] } },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
    if (count === 0) throw new DomainError("Pedidos entregues ou já cancelados não podem ser cancelados.");

    const sales = await tx.stockMovement.findMany({
      where: { orderId, type: "SALE" },
      orderBy: { productId: "asc" },
    });
    for (const sale of sales) {
      await tx.product.update({
        where: { id: sale.productId },
        data: { stockQuantity: { increment: -sale.quantity } },
      });
    }
    if (sales.length > 0) {
      await tx.stockMovement.createMany({
        data: sales.map((sale) => ({
          productId: sale.productId,
          eventId: sale.eventId,
          orderId,
          type: "CANCELLATION" as const,
          quantity: -sale.quantity,
          createdById,
        })),
      });
    }
  });
}

/** Dados do cupom para impressão e reimpressão (RF-03). */
export async function getReceiptData(db: PrismaClient, orderId: string): Promise<ReceiptData> {
  const [order, settings] = await Promise.all([
    db.order.findUnique({
      where: { id: orderId },
      include: {
        event: { select: { name: true } },
        items: { include: { components: true }, orderBy: [{ kind: "desc" }, { description: "asc" }] },
      },
    }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  if (!order) throw new DomainError("Pedido não encontrado.");

  return {
    header: settings?.receiptHeader ?? "CANTINA G7",
    eventName: order.event.name,
    number: order.number,
    isReservation: order.isReservation,
    customerName: order.customerName,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      quantity: item.quantity,
      description: item.description,
      totalCents: toCents(item.unitPrice) * item.quantity,
      components: item.components.map((component) => component.description),
    })),
    notes: order.notes,
    totalCents: toCents(order.total),
    paymentLabel: order.status === "CANCELED" ? "PEDIDO CANCELADO" : paymentLabel(order.paymentMethod),
  };
}
