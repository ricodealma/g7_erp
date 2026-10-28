import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { fromCents, toCents } from "@/lib/money";

import { DomainError } from "../counter/errors";
import { closeEventSchema, settleSchema, type CloseEventInput, type SettleInput } from "./schemas";

const OPEN_STATUSES = ["AWAITING_CONFIRMATION", "PENDING", "READY"] as const;
const NOT_CANCELED = { status: { not: "CANCELED" } } as const;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

// ------------------------------------------------------------------ Visão geral

export type EventSummary = {
  id: string;
  name: string;
  date: string;
  status: "OPEN" | "CLOSED";
  orderCount: number;
  totalCents: number;
  cashDifferenceCents: number | null;
};

export async function listEvents(db: PrismaClient, take = 60): Promise<EventSummary[]> {
  const events = await db.event.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take });
  const totals = await db.order.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((event) => event.id) }, ...NOT_CANCELED },
    _sum: { total: true },
    _count: true,
  });
  const byEvent = new Map(totals.map((row) => [row.eventId, row]));

  return events.map((event) => {
    const row = byEvent.get(event.id);
    return {
      id: event.id,
      name: event.name,
      date: isoDate(event.date),
      status: event.status,
      orderCount: row?._count ?? 0,
      totalCents: toCents(row?._sum.total ?? 0),
      cashDifferenceCents:
        event.countedCash && event.expectedCash ? toCents(event.countedCash) - toCents(event.expectedCash) : null,
    };
  });
}

// ------------------------------------------------------------------ Fiado (RF-12 / RF-16)

export type PendingPayment = {
  id: string;
  number: number;
  totalCents: number;
  createdAt: string;
  eventName: string;
  eventDate: string;
  summary: string;
};

/** Conta de fiado: todos os pedidos em aberto da mesma pessoa. */
export type PendingAccount = {
  customerId: string;
  name: string;
  totalCents: number;
  orders: PendingPayment[];
};

const PENDING_PAY_LATER = { paymentMethod: "PAY_LATER", paymentStatus: "PENDING", ...NOT_CANCELED } as const;

export async function listPendingAccounts(db: PrismaClient): Promise<PendingAccount[]> {
  const orders = await db.order.findMany({
    where: PENDING_PAY_LATER,
    include: { event: true, items: true, customer: true },
    orderBy: { createdAt: "asc" },
  });
  const accounts = new Map<string, PendingAccount>();
  for (const order of orders) {
    const customer = order.customer!;
    const account = accounts.get(customer.id) ?? {
      customerId: customer.id,
      name: customer.name,
      totalCents: 0,
      orders: [],
    };
    const totalCents = toCents(order.total);
    account.totalCents += totalCents;
    account.orders.push({
      id: order.id,
      number: order.number,
      totalCents,
      createdAt: order.createdAt.toISOString(),
      eventName: order.event.name,
      eventDate: isoDate(order.event.date),
      summary: order.items.map((item) => `${item.quantity}x ${item.description}`).join(", "),
    });
    accounts.set(customer.id, account);
  }
  return [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function pendingPaymentsTotal(db: PrismaClient) {
  const rows = await db.order.groupBy({
    by: ["customerId"],
    where: PENDING_PAY_LATER,
    _sum: { total: true },
    _count: true,
  });
  return {
    accounts: rows.length,
    count: rows.reduce((sum, row) => sum + row._count, 0),
    totalCents: rows.reduce((sum, row) => sum + toCents(row._sum.total ?? 0), 0),
  };
}

/**
 * Quita pedidos "pagar depois" (um pedido ou a conta inteira). O valor entra no caixa do
 * evento aberto no momento da quitação (se houver), que é onde o dinheiro fisicamente está.
 * Tudo ou nada: se algum pedido já foi quitado ou cancelado, nada é alterado.
 */
export async function settlePayments(db: PrismaClient, rawInput: SettleInput, settledById?: string) {
  const { method, ...input } = settleSchema.parse(rawInput);
  const orderIds = [...new Set(input.orderIds)];
  await db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { status: "OPEN" }, select: { id: true } });
    const { count } = await tx.order.updateMany({
      where: { id: { in: orderIds }, ...PENDING_PAY_LATER },
      data: {
        paymentStatus: "PAID",
        settledWith: method,
        paidAt: new Date(),
        settledEventId: event?.id ?? null,
        settledById,
      },
    });
    if (count !== orderIds.length) {
      throw new DomainError("A conta mudou (pedido já quitado ou cancelado). Atualize a página e confira.");
    }
  });
}

// ------------------------------------------------------------------ Relatório do evento e fechamento

type MethodTotals = { PIX: number; CASH: number; PAY_LATER_PAID: number; PAY_LATER_PENDING: number };

export type EventReport = {
  event: {
    id: string;
    name: string;
    date: string;
    status: "OPEN" | "CLOSED";
    closedAt: string | null;
    closedByName: string | null;
    countedCashCents: number | null;
    closingNotes: string | null;
  };
  orderCount: number;
  canceledCount: number;
  openOrderCount: number;
  totalCents: number;
  /** Vendas do evento pela forma de pagamento escolhida no pedido. */
  byMethod: MethodTotals;
  /** Quitações de fiado recebidas durante este evento (de qualquer evento). */
  settlements: { pixCents: number; cashCents: number; count: number };
  /** Dinheiro que deveria estar no caixa: vendas em dinheiro + fiado quitado em dinheiro. */
  expectedCashCents: number;
  items: { key: string; description: string; combo: boolean; quantity: number; totalCents: number }[];
  /** Unidades por produto, somando avulsos e itens dentro de combos (produção/estoque). */
  units: { productId: string; name: string; quantity: number }[];
};

async function computeExpectedCash(db: Prisma.TransactionClient | PrismaClient, eventId: string) {
  const [sales, settlements] = await Promise.all([
    db.order.aggregate({ where: { eventId, paymentMethod: "CASH", ...NOT_CANCELED }, _sum: { total: true } }),
    db.order.aggregate({
      where: { settledEventId: eventId, settledWith: "CASH", ...NOT_CANCELED },
      _sum: { total: true },
    }),
  ]);
  return toCents(sales._sum.total ?? 0) + toCents(settlements._sum.total ?? 0);
}

export async function getEventReport(db: PrismaClient, eventId: string): Promise<EventReport | null> {
  const event = await db.event.findUnique({ where: { id: eventId }, include: { closedBy: true } });
  if (!event) return null;

  const [orders, settled, liveExpectedCash] = await Promise.all([
    db.order.findMany({
      where: { eventId },
      include: { items: { include: { components: { include: { product: true } }, product: true } } },
    }),
    db.order.findMany({
      where: { settledEventId: eventId, ...NOT_CANCELED },
      select: { total: true, settledWith: true },
    }),
    event.status === "OPEN" ? computeExpectedCash(db, eventId) : Promise.resolve(0),
  ]);

  const byMethod: MethodTotals = { PIX: 0, CASH: 0, PAY_LATER_PAID: 0, PAY_LATER_PENDING: 0 };
  const items = new Map<string, EventReport["items"][number]>();
  const units = new Map<string, EventReport["units"][number]>();
  const addUnits = (productId: string, name: string, quantity: number) => {
    const row = units.get(productId) ?? { productId, name, quantity: 0 };
    row.quantity += quantity;
    units.set(productId, row);
  };

  let canceledCount = 0;
  let openOrderCount = 0;
  let totalCents = 0;
  for (const order of orders) {
    if (order.status === "CANCELED") {
      canceledCount++;
      continue;
    }
    if ((OPEN_STATUSES as readonly string[]).includes(order.status)) openOrderCount++;

    const orderCents = toCents(order.total);
    totalCents += orderCents;
    if (order.paymentMethod === "PAY_LATER") {
      byMethod[order.paymentStatus === "PAID" ? "PAY_LATER_PAID" : "PAY_LATER_PENDING"] += orderCents;
    } else {
      byMethod[order.paymentMethod] += orderCents;
    }

    for (const item of order.items) {
      const key = item.comboId ?? item.productId ?? item.description;
      const row = items.get(key) ?? {
        key,
        description: item.description,
        combo: item.kind === "COMBO",
        quantity: 0,
        totalCents: 0,
      };
      row.quantity += item.quantity;
      row.totalCents += item.quantity * toCents(item.unitPrice);
      items.set(key, row);

      if (item.kind === "PRODUCT" && item.product) addUnits(item.product.id, item.product.name, item.quantity);
      for (const component of item.components) addUnits(component.product.id, component.product.name, item.quantity);
    }
  }

  const settlements = { pixCents: 0, cashCents: 0, count: settled.length };
  for (const order of settled) {
    settlements[order.settledWith === "CASH" ? "cashCents" : "pixCents"] += toCents(order.total);
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      date: isoDate(event.date),
      status: event.status,
      closedAt: event.closedAt?.toISOString() ?? null,
      closedByName: event.closedBy?.name ?? null,
      countedCashCents: event.countedCash ? toCents(event.countedCash) : null,
      closingNotes: event.closingNotes,
    },
    orderCount: orders.length - canceledCount,
    canceledCount,
    openOrderCount,
    totalCents,
    byMethod,
    settlements,
    expectedCashCents: event.expectedCash ? toCents(event.expectedCash) : liveExpectedCash,
    items: [...items.values()].sort((a, b) => b.totalCents - a.totalCents),
    units: [...units.values()].sort((a, b) => b.quantity - a.quantity),
  };
}

/**
 * Fechamento de caixa (RF-16): congela o dinheiro esperado, registra o contado e encerra
 * o evento. Exige todos os pedidos entregues ou cancelados.
 */
export async function closeEvent(db: PrismaClient, rawInput: CloseEventInput, closedById?: string) {
  const { eventId, countedCashCents, notes } = closeEventSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const openOrders = await tx.order.count({ where: { eventId, status: { in: [...OPEN_STATUSES] } } });
    if (openOrders > 0) {
      throw new DomainError(`Há ${openOrders} pedido(s) não entregue(s). Entregue ou cancele antes de encerrar.`);
    }
    const expectedCashCents = await computeExpectedCash(tx, eventId);
    const { count } = await tx.event.updateMany({
      where: { id: eventId, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById,
        expectedCash: fromCents(expectedCashCents),
        countedCash: fromCents(countedCashCents),
        closingNotes: notes || null,
      },
    });
    if (count === 0) throw new DomainError("Evento já encerrado ou inexistente.");
    return { expectedCashCents, differenceCents: countedCashCents - expectedCashCents };
  });
}
