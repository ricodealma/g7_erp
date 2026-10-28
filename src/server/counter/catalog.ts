import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { fromCents } from "@/lib/money";

import { DomainError } from "./errors";
import {
  menuItemSchema,
  openEventSchema,
  quickSnackSchema,
  restockSchema,
  type OpenEventInput,
  type QuickSnackInput,
} from "./schemas";

async function requireOpenEvent(db: Prisma.TransactionClient | PrismaClient) {
  const event = await db.event.findFirst({ where: { status: "OPEN" }, select: { id: true } });
  if (!event) throw new DomainError("Nenhum evento aberto.");
  return event;
}

/** Abre o evento do dia com o cardápio de lanches (RF-05, RF-13). */
export async function openEvent(db: PrismaClient, rawInput: OpenEventInput) {
  const input = openEventSchema.parse(rawInput);
  try {
    return await db.event.create({
      data: {
        name: input.name,
        date: new Date(`${input.date}T00:00:00Z`),
        menu: { create: input.snackIds.map((productId) => ({ productId })) },
      },
      select: { id: true },
    });
  } catch (error) {
    // Índice único parcial "events_single_open".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError("Já existe um evento aberto.");
    }
    throw error;
  }
}

/** Encerra o evento aberto. O fechamento de caixa completo fica no painel administrativo. */
export async function closeEvent(db: PrismaClient, closedById?: string) {
  const event = await requireOpenEvent(db);
  const openOrders = await db.order.count({
    where: { eventId: event.id, status: { in: ["AWAITING_CONFIRMATION", "PENDING", "READY"] } },
  });
  if (openOrders > 0) {
    throw new DomainError(`Há ${openOrders} pedido(s) não entregue(s). Entregue ou cancele antes de encerrar.`);
  }
  await db.event.update({
    where: { id: event.id },
    data: { status: "CLOSED", closedAt: new Date(), closedById },
  });
}

/** Inclui/remove um lanche do cardápio do dia ou marca como esgotado (RF-05, RF-09a). */
export async function updateMenuItem(db: PrismaClient, rawInput: { productId: string; inMenu?: boolean; soldOut?: boolean }) {
  const { productId, inMenu, soldOut } = menuItemSchema.parse(rawInput);
  const event = await requireOpenEvent(db);
  const key = { eventId_productId: { eventId: event.id, productId } };

  if (inMenu === false) {
    await db.eventMenuItem.deleteMany({ where: { eventId: event.id, productId } });
    return;
  }
  await db.eventMenuItem.upsert({
    where: key,
    create: { eventId: event.id, productId, soldOut: soldOut ?? false },
    update: soldOut === undefined ? {} : { soldOut },
  });
}

/** Cadastro rápido de lanche do dia, já incluído no cardápio do evento aberto. */
export async function createQuickSnack(db: PrismaClient, rawInput: QuickSnackInput) {
  const input = quickSnackSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const event = await requireOpenEvent(tx);
    const existing = await tx.product.findUnique({ where: { name: input.name } });
    if (existing) throw new DomainError(`Já existe um produto chamado ${input.name}.`);

    const product = await tx.product.create({
      data: {
        name: input.name,
        category: "SNACK",
        price: fromCents(input.priceCents),
        stockControl: input.countable ? "COUNTABLE" : "UNCOUNTABLE",
        stockQuantity: input.countable ? (input.stockQuantity ?? 0) : null,
        lowStockThreshold: input.countable ? 3 : null,
        eventMenu: { create: { eventId: event.id } },
      },
      select: { id: true },
    });
    if (input.countable && input.stockQuantity) {
      await tx.stockMovement.create({
        data: { productId: product.id, eventId: event.id, type: "RESTOCK", quantity: input.stockQuantity },
      });
    }
    return product;
  });
}

/** Entrada rápida de estoque (RF-11). */
export async function restock(db: PrismaClient, rawInput: { productId: string; quantity: number }, createdById?: string) {
  const { productId, quantity } = restockSchema.parse(rawInput);
  await db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { status: "OPEN" }, select: { id: true } });
    const { count } = await tx.product.updateMany({
      where: { id: productId, stockControl: "COUNTABLE" },
      data: { stockQuantity: { increment: quantity } },
    });
    if (count === 0) throw new DomainError("Produto sem controle de estoque.");
    await tx.stockMovement.create({
      data: { productId, eventId: event?.id, type: "RESTOCK", quantity, createdById },
    });
  });
}
