import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeEvent } from "@/server/admin/finance";
import { createQuickSnack, openEvent, restock, updateMenuItem } from "@/server/counter/catalog";
import { DomainError } from "@/server/counter/errors";
import { cancelOrder, createOrder, getReceiptData, setOrderStatus } from "@/server/counter/orders";
import { getCounterSnapshot } from "@/server/counter/queries";

import { createTestDb, seedFixtures } from "./helpers";

const db = createTestDb();
let fx: Awaited<ReturnType<typeof seedFixtures>>;

beforeEach(async () => {
  fx = await seedFixtures(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const stockOf = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stockQuantity;

describe("createOrder", () => {
  it("aplica combo, baixa estoque, registra movimentação e numera por evento", async () => {
    const first = await createOrder(db, {
      customerName: "Marcos",
      paymentMethod: "PIX",
      notes: "Sem maionese",
      lines: [
        { productId: fx.pizza.id, quantity: 1 },
        { productId: fx.refri.id, quantity: 2 },
      ],
    });
    const second = await createOrder(db, {
      customerName: "Ana",
      paymentMethod: "CASH",
      amountReceivedCents: 500,
      lines: [{ productId: fx.pitchula.id, quantity: 1 }],
    });

    expect(first.number).toBe(1);
    expect(second.number).toBe(2);

    const order = await db.order.findUniqueOrThrow({
      where: { id: first.id },
      include: { items: { include: { components: true } }, stockMovements: true },
    });
    // Pizza + Refri -> combo 10,00; Refri avulso 5,00.
    expect(order.total.toString()).toBe("15");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.items.find((item) => item.kind === "COMBO")?.components).toHaveLength(2);
    expect(await stockOf(fx.pizza.id)).toBe(4);
    expect(await stockOf(fx.refri.id)).toBe(8);
    expect(order.stockMovements.map((movement) => movement.quantity).sort()).toEqual([-1, -2]);

    const receipt = await getReceiptData(db, first.id);
    expect(receipt).toMatchObject({ number: 1, header: "CANTINA TESTE", totalCents: 1500, notes: "Sem maionese" });
  });

  it("recusa estoque insuficiente sem alterar nada (transação atômica)", async () => {
    await expect(
      createOrder(db, {
        customerName: "Ana",
        paymentMethod: "PIX",
        lines: [
          { productId: fx.refri.id, quantity: 1 },
          { productId: fx.pitchula.id, quantity: 3 },
        ],
      }),
    ).rejects.toThrow(/Estoque insuficiente de Pitchulinha/);

    expect(await stockOf(fx.refri.id)).toBe(10);
    expect(await db.order.count()).toBe(0);
    expect((await db.event.findUniqueOrThrow({ where: { id: fx.event.id } })).orderSequence).toBe(0);
  });

  it("pedidos simultâneos não vendem além do estoque nem repetem número", async () => {
    const attempt = (customerName: string) =>
      createOrder(db, { customerName, paymentMethod: "PIX", lines: [{ productId: fx.pitchula.id, quantity: 2 }] });
    const results = await Promise.allSettled([attempt("A"), attempt("B"), attempt("C")]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(fx.pitchula.id)).toBe(0);

    const numbers = await Promise.all(
      ["D", "E", "F"].map((customerName) =>
        createOrder(db, { customerName, paymentMethod: "PIX", lines: [{ productId: fx.pernil.id, quantity: 1 }] }),
      ),
    );
    expect(new Set(numbers.map((order) => order.number)).size).toBe(3);
  });

  it("recusa lanche fora do cardápio do dia ou esgotado", async () => {
    await expect(
      createOrder(db, {
        customerName: "Ana",
        paymentMethod: "PIX",
        lines: [{ productId: fx.macarrao.id, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await updateMenuItem(db, { productId: fx.pernil.id, soldOut: true });
    await expect(
      createOrder(db, { customerName: "Ana", paymentMethod: "PIX", lines: [{ productId: fx.pernil.id, quantity: 1 }] }),
    ).rejects.toThrow(/não está disponível/);
  });

  it("registra fiado como pagamento pendente", async () => {
    const { id } = await createOrder(db, {
      customerName: "João",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.pernil.id, quantity: 2 }],
    });
    const order = await db.order.findUniqueOrThrow({ where: { id } });
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.paidAt).toBeNull();
  });

  it("recusa dinheiro recebido menor que o total", async () => {
    await expect(
      createOrder(db, {
        customerName: "João",
        paymentMethod: "CASH",
        amountReceivedCents: 100,
        lines: [{ productId: fx.pernil.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/menor que o total/);
  });

  it("exige evento aberto", async () => {
    await db.event.update({ where: { id: fx.event.id }, data: { status: "CLOSED" } });
    await expect(
      createOrder(db, { customerName: "Ana", paymentMethod: "PIX", lines: [{ productId: fx.refri.id, quantity: 1 }] }),
    ).rejects.toThrow(/Nenhum evento aberto/);
  });
});

describe("reservas e cancelamento", () => {
  it("reserva bloqueia estoque e o cancelamento devolve", async () => {
    const { id } = await createOrder(db, {
      customerName: "Reserva",
      paymentMethod: "PIX",
      isReservation: true,
      lines: [
        { productId: fx.pizza.id, quantity: 2 },
        { productId: fx.pitchula.id, quantity: 2 },
      ],
    });
    expect(await stockOf(fx.pizza.id)).toBe(3);
    expect(await stockOf(fx.pitchula.id)).toBe(0);

    await cancelOrder(db, id);

    expect(await stockOf(fx.pizza.id)).toBe(5);
    expect(await stockOf(fx.pitchula.id)).toBe(2);
    const movements = await db.stockMovement.findMany({ where: { orderId: id, type: "CANCELLATION" } });
    expect(movements.map((movement) => movement.quantity).sort()).toEqual([2, 2]);
    await expect(cancelOrder(db, id)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("status do pedido", () => {
  it("segue Em preparo -> Pronto -> Entregue e bloqueia cancelamento após entrega", async () => {
    const { id } = await createOrder(db, {
      customerName: "Ana",
      paymentMethod: "PIX",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });

    await setOrderStatus(db, { orderId: id, status: "READY" });
    await setOrderStatus(db, { orderId: id, status: "DELIVERED" });
    await expect(setOrderStatus(db, { orderId: id, status: "READY" })).rejects.toBeInstanceOf(DomainError);
    await expect(cancelOrder(db, id)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("evento, cardápio e estoque", () => {
  it("impede encerrar com pedidos em aberto e reinicia a numeração no novo evento", async () => {
    const { id } = await createOrder(db, {
      customerName: "Ana",
      paymentMethod: "PIX",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    await expect(closeEvent(db, { eventId: fx.event.id, countedCashCents: 0 })).rejects.toThrow(/não entregue/);

    await setOrderStatus(db, { orderId: id, status: "DELIVERED" });
    await closeEvent(db, { eventId: fx.event.id, countedCashCents: 0 });

    await openEvent(db, { name: "Culto Seguinte", date: "2026-11-08", snackIds: [fx.pernil.id] });
    await expect(openEvent(db, { name: "Duplicado", date: "2026-11-08" })).rejects.toThrow(
      /Já existe um evento aberto/,
    );

    const next = await createOrder(db, {
      customerName: "Bia",
      paymentMethod: "PIX",
      lines: [{ productId: fx.pernil.id, quantity: 1 }],
    });
    expect(next.number).toBe(1);
  });

  it("entrada rápida e cadastro de lanche do dia atualizam o snapshot do balcão", async () => {
    await restock(db, { productId: fx.pitchula.id, quantity: 24 });
    await createQuickSnack(db, { name: "Macarrão Especial", priceCents: 1500, countable: true, stockQuantity: 20 });
    await updateMenuItem(db, { productId: fx.pizza.id, inMenu: false });

    const snapshot = await getCounterSnapshot(db);
    const byName = new Map(snapshot.products.map((product) => [product.name, product]));

    expect(byName.get("Pitchulinha")?.stockQuantity).toBe(26);
    expect(byName.get("Macarrão Especial")).toMatchObject({ inMenu: true, stockQuantity: 20, priceCents: 1500 });
    expect(byName.get("Pizza")?.inMenu).toBe(false);
    expect(byName.get("Refri Lata")?.inMenu).toBe(true);
    await expect(restock(db, { productId: fx.pernil.id, quantity: 1 })).rejects.toBeInstanceOf(DomainError);
  });
});
