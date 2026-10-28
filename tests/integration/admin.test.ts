import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createProduct, saveCombo, setStockCount, updateProduct, updateSettings } from "@/server/admin/catalog";
import {
  closeEvent,
  getEventReport,
  listEvents,
  listPendingAccounts,
  pendingPaymentsTotal,
  settlePayments,
} from "@/server/admin/finance";
import { createUser, resetPassword, updateUser, type AuthAdmin } from "@/server/admin/users";
import { openEvent } from "@/server/counter/catalog";
import { DomainError } from "@/server/counter/errors";
import { accountBalanceCents, cancelOrder, createOrder, setOrderStatus } from "@/server/counter/orders";
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

async function deliveredOrder(input: Parameters<typeof createOrder>[1]) {
  const order = await createOrder(db, input);
  await setOrderStatus(db, { orderId: order.id, status: "DELIVERED" });
  return order;
}

describe("fiado e fechamento de caixa", () => {
  it("quita fiado no caixa do evento aberto e fecha com esperado x contado", async () => {
    await deliveredOrder({
      customerName: "Ana",
      paymentMethod: "CASH",
      lines: [{ productId: fx.refri.id, quantity: 2 }],
    });
    await deliveredOrder({
      customerName: "Bia",
      paymentMethod: "PIX",
      lines: [{ productId: fx.pitchula.id, quantity: 1 }],
    });
    const fiado = await deliveredOrder({
      customerName: "Caio",
      paymentMethod: "PAY_LATER",
      lines: [
        { productId: fx.pizza.id, quantity: 1 },
        { productId: fx.refri.id, quantity: 1 },
      ],
    });
    const canceled = await createOrder(db, {
      customerName: "Davi",
      paymentMethod: "CASH",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    await cancelOrder(db, canceled.id);

    expect(await pendingPaymentsTotal(db)).toEqual({ accounts: 1, count: 1, totalCents: 1000 });
    const [pending] = await listPendingAccounts(db);
    expect(pending).toMatchObject({ name: "Caio", totalCents: 1000, orders: [{ eventName: "Culto Teste" }] });

    await settlePayments(db, { orderIds: [fiado.id], method: "CASH" });
    await expect(settlePayments(db, { orderIds: [fiado.id], method: "PIX" })).rejects.toBeInstanceOf(DomainError);
    expect(await pendingPaymentsTotal(db)).toEqual({ accounts: 0, count: 0, totalCents: 0 });

    const report = await getEventReport(db, fx.event.id);
    expect(report).toMatchObject({
      orderCount: 3,
      canceledCount: 1,
      openOrderCount: 0,
      totalCents: 2300,
      byMethod: { PIX: 300, CASH: 1000, PAY_LATER_PAID: 1000, PAY_LATER_PENDING: 0 },
      settlements: { cashCents: 1000, pixCents: 0, count: 1 },
      // Venda em dinheiro (10,00) + fiado quitado em dinheiro (10,00); o cancelado não entra.
      expectedCashCents: 2000,
    });
    expect(report?.items.find((item) => item.combo)).toMatchObject({ quantity: 1, totalCents: 1000 });
    // Unidades somam avulsos e itens dentro do combo.
    expect(report?.units.find((unit) => unit.name === "Refri Lata")?.quantity).toBe(3);

    const closing = await closeEvent(db, { eventId: fx.event.id, countedCashCents: 1950, notes: "Faltou troco" });
    expect(closing).toEqual({ expectedCashCents: 2000, differenceCents: -50 });
    await expect(closeEvent(db, { eventId: fx.event.id, countedCashCents: 0 })).rejects.toThrow(/já encerrado/);

    const [summary] = await listEvents(db);
    expect(summary).toMatchObject({ status: "CLOSED", orderCount: 3, totalCents: 2300, cashDifferenceCents: -50 });
    expect((await getEventReport(db, fx.event.id))?.event).toMatchObject({
      countedCashCents: 1950,
      closingNotes: "Faltou troco",
    });
  });

  it("quitação em evento posterior entra no caixa desse evento", async () => {
    const fiado = await deliveredOrder({
      customerName: "Caio",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    await closeEvent(db, { eventId: fx.event.id, countedCashCents: 0 });

    await settlePayments(db, { orderIds: [fiado.id], method: "PIX" });
    expect((await db.order.findUniqueOrThrow({ where: { id: fiado.id } })).settledEventId).toBeNull();

    const next = await openEvent(db, { name: "Culto Seguinte", date: "2026-11-08" });
    const other = await deliveredOrder({
      customerName: "Lia",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    await settlePayments(db, { orderIds: [other.id], method: "CASH" });

    const report = await getEventReport(db, next.id);
    expect(report?.settlements).toEqual({ pixCents: 0, cashCents: 500, count: 1 });
    expect(report?.expectedCashCents).toBe(500);
  });
});

describe("conta de fiado por pessoa", () => {
  it("agrupa os fiados pelo nome sem diferenciar maiúsculas, acentos e espaços", async () => {
    const first = await createOrder(db, {
      customerName: "  Ricardo  Sá ",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    const second = await createOrder(db, {
      customerName: "ricardo sa",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.pizza.id, quantity: 1 }],
    });
    // Pagamento na hora não abre conta, mesmo com o mesmo nome.
    const paid = await createOrder(db, {
      customerName: "Ricardo Sá",
      paymentMethod: "PIX",
      lines: [{ productId: fx.pitchula.id, quantity: 1 }],
    });
    await createOrder(db, {
      customerName: "Lia",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });

    expect(first.customerId).toBe(second.customerId);
    expect(paid.customerId).toBeNull();
    expect(await db.customer.count()).toBe(2);
    expect(await accountBalanceCents(db, first.customerId!)).toBe(1250);

    // Nome da conta mantém a grafia do primeiro fiado e vale para os pedidos seguintes.
    const orders = await db.order.findMany({ where: { customerId: first.customerId }, orderBy: { number: "asc" } });
    expect(orders.map((order) => order.customerName)).toEqual(["Ricardo Sá", "Ricardo Sá"]);

    const accounts = await listPendingAccounts(db);
    expect(accounts.map((account) => [account.name, account.totalCents, account.orders.length])).toEqual([
      ["Lia", 500, 1],
      ["Ricardo Sá", 1250, 2],
    ]);
    expect((await getCounterSnapshot(db)).accounts).toEqual([
      { id: expect.any(String), name: "Lia", key: "lia", balanceCents: 500 },
      { id: first.customerId, name: "Ricardo Sá", key: "ricardo sa", balanceCents: 1250 },
    ]);
    expect(await pendingPaymentsTotal(db)).toEqual({ accounts: 2, count: 3, totalCents: 1750 });

    // Cancelado sai da conta.
    await cancelOrder(db, second.id);
    expect(await accountBalanceCents(db, first.customerId!)).toBe(500);
  });

  it("quita a conta inteira de uma vez, ou nada se ela mudou", async () => {
    const refri = await createOrder(db, {
      customerName: "Ricardo",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.refri.id, quantity: 1 }],
    });
    const pizza = await createOrder(db, {
      customerName: "Ricardo",
      paymentMethod: "PAY_LATER",
      lines: [{ productId: fx.pizza.id, quantity: 1 }],
    });

    await settlePayments(db, { orderIds: [pizza.id], method: "PIX" });
    // A tela ainda mostrava os dois pedidos: nenhum é quitado e o usuário confere de novo.
    await expect(settlePayments(db, { orderIds: [refri.id, pizza.id], method: "CASH" })).rejects.toThrow(
      /A conta mudou/,
    );
    expect(await accountBalanceCents(db, refri.customerId!)).toBe(500);

    await settlePayments(db, { orderIds: [refri.id], method: "CASH" });
    expect(await listPendingAccounts(db)).toEqual([]);
    expect((await getEventReport(db, fx.event.id))?.settlements).toEqual({ pixCents: 750, cashCents: 500, count: 2 });
  });
});

describe("cadastros", () => {
  it("produto contável registra saldo inicial e contagem de inventário como ajuste", async () => {
    const { id } = await createProduct(db, {
      product: { name: "Suco", category: "DRINK", priceCents: 400, countable: true, lowStockThreshold: 2 },
      initialStock: 12,
    });
    await expect(
      createProduct(db, { product: { name: "Suco", category: "DRINK", priceCents: 400, countable: false } }),
    ).rejects.toThrow(/Já existe/);

    await setStockCount(db, { productId: id, quantity: 9 });
    await setStockCount(db, { productId: id, quantity: 9 });
    const movements = await db.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "asc" } });
    expect(movements.map((movement) => [movement.type, movement.quantity])).toEqual([
      ["ADJUSTMENT", 12],
      ["ADJUSTMENT", -3],
    ]);

    // Trocar para não contável descarta saldo e limite; voltar começa do zero.
    await updateProduct(db, {
      id,
      product: { name: "Suco Natural", category: "DRINK", priceCents: 450, countable: false, lowStockThreshold: 2 },
    });
    expect(await db.product.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: "Suco Natural",
      stockQuantity: null,
      lowStockThreshold: null,
    });
    await expect(setStockCount(db, { productId: id, quantity: 1 })).rejects.toBeInstanceOf(DomainError);
    await updateProduct(db, {
      id,
      product: { name: "Suco Natural", category: "DRINK", priceCents: 450, countable: true, lowStockThreshold: 1 },
    });
    expect((await db.product.findUniqueOrThrow({ where: { id } })).stockQuantity).toBe(0);
  });

  it("combo exige lanche e bebida e substitui as opções na edição", async () => {
    await expect(
      saveCombo(db, { name: "Só bebidas", priceCents: 700, optionIds: [fx.refri.id, fx.pitchula.id] }),
    ).rejects.toThrow(/lanche e uma bebida/);

    const { id } = await saveCombo(db, {
      name: "Combo Macarrão",
      priceCents: 1400,
      optionIds: [fx.macarrao.id, fx.refri.id],
    });
    await saveCombo(db, {
      id,
      name: "Combo Macarrão",
      priceCents: 1300,
      optionIds: [fx.macarrao.id, fx.pitchula.id],
      active: false,
    });
    const combo = await db.combo.findUniqueOrThrow({ where: { id }, include: { options: true } });
    expect(combo.price.toString()).toBe("13");
    expect(combo.active).toBe(false);
    expect(combo.options.map((option) => option.productId).sort()).toEqual([fx.macarrao.id, fx.pitchula.id].sort());
  });

  it("configurações respeitam os limites do BR Code", async () => {
    const settings = { pixKey: "nova@pix.com", pixMerchant: "CANTINA G7", pixCity: "SAO PAULO", receiptHeader: "G7" };
    await updateSettings(db, settings);
    expect(await db.settings.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject(settings);
    await expect(updateSettings(db, { ...settings, pixCity: "CIDADE COM NOME LONGO" })).rejects.toThrow();
  });
});

describe("usuários", () => {
  function fakeAuth(existing: Record<string, string> = {}) {
    const passwords = new Map<string, string>();
    const auth: AuthAdmin = {
      findUserIdByEmail: async (email) => existing[email] ?? null,
      createUser: async ({ password }) => {
        const id = randomUUID();
        passwords.set(id, password);
        return id;
      },
      setPassword: async (id, password) => void passwords.set(id, password),
    };
    return { auth, passwords };
  }

  it("cria com senha gerada, reaproveita login existente e redefine senha", async () => {
    const { auth, passwords } = fakeAuth({ "antigo@g7.test": randomUUID() });

    const created = await createUser(db, auth, { email: "Novo@G7.test", name: "Novo", role: "OPERATOR" });
    expect(created.password).toHaveLength(12);
    expect(passwords.get(created.id)).toBe(created.password);
    expect(await db.profile.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({
      email: "novo@g7.test",
      role: "OPERATOR",
      active: true,
    });
    await expect(createUser(db, auth, { email: "novo@g7.test", name: "X", role: "ADMIN" })).rejects.toThrow(
      /Já existe/,
    );

    const linked = await createUser(db, auth, { email: "antigo@g7.test", name: "Antigo", role: "ADMIN" });
    expect(passwords.get(linked.id)).toBe(linked.password);

    const { password } = await resetPassword(db, auth, created.id);
    expect(passwords.get(created.id)).toBe(password);
    expect(password).not.toBe(created.password);
  });

  it("admin não remove o próprio acesso, mas gerencia os demais", async () => {
    const { auth } = fakeAuth();
    const admin = await createUser(db, auth, { email: "admin@g7.test", name: "Admin", role: "ADMIN" });
    const operator = await createUser(db, auth, { email: "op@g7.test", name: "Op", role: "OPERATOR" });

    await expect(
      updateUser(db, { id: admin.id, name: "Admin", role: "OPERATOR", active: true }, admin.id),
    ).rejects.toThrow(/próprio acesso/);
    await expect(
      updateUser(db, { id: admin.id, name: "Admin", role: "ADMIN", active: false }, admin.id),
    ).rejects.toThrow(/próprio acesso/);

    await updateUser(db, { id: operator.id, name: "Operador", role: "OPERATOR", active: false }, admin.id);
    expect(await db.profile.findUniqueOrThrow({ where: { id: operator.id } })).toMatchObject({
      name: "Operador",
      active: false,
    });
  });
});
