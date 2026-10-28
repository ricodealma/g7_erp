import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { customerKey } from "@/lib/customer";
import { toCents } from "@/lib/money";

export type CounterProduct = {
  id: string;
  name: string;
  category: "SNACK" | "DRINK";
  priceCents: number;
  countable: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  inMenu: boolean;
  soldOut: boolean;
};

export type CounterOrder = {
  id: string;
  number: number;
  customerName: string;
  status: "AWAITING_CONFIRMATION" | "PENDING" | "READY" | "DELIVERED" | "CANCELED";
  isReservation: boolean;
  totalCents: number;
  paymentMethod: "PIX" | "CASH" | "PAY_LATER";
  paymentStatus: "PENDING" | "PAID";
  createdAt: string;
  summary: string;
};

/** Conta de fiado com saldo em aberto (sugestão ao digitar o nome). */
export type OpenAccount = { id: string; name: string; key: string; balanceCents: number };

/**
 * Conta a receber: o que a pessoa já pegou (pedidos "pagar depois" entregues, de qualquer
 * evento), com os itens somados. Pedidos ainda em preparo entram quando forem entregues.
 */
export type Receivable = {
  customerId: string;
  name: string;
  totalCents: number;
  orderIds: string[];
  orderNumbers: { number: number; eventName: string; current: boolean }[];
  items: { description: string; quantity: number; totalCents: number }[];
  inPreparation: { count: number; totalCents: number };
};

export type CounterSnapshot = {
  event: { id: string; name: string; date: string } | null;
  settings: { pixKey: string; pixMerchant: string; pixCity: string };
  products: CounterProduct[];
  combos: { id: string; name: string; optionIds: string[] }[];
  orders: CounterOrder[];
  accounts: OpenAccount[];
  receivables: Receivable[];
};

const itemsInclude = { items: { include: { components: true } } } as const;
type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof itemsInclude }>;

function describeItem(item: OrderWithItems["items"][number]) {
  const parts = item.components.map((component) => component.description).join(" + ");
  return `${item.description}${parts ? ` (${parts})` : ""}`;
}

function buildReceivables(
  orders: (OrderWithItems & { event: { name: string }; customer: { name: string } | null })[],
  currentEventId: string | undefined,
): Receivable[] {
  type Draft = Receivable & { lines: Map<string, Receivable["items"][number]> };
  const byCustomer = new Map<string, Draft>();
  for (const order of orders) {
    if (!order.customerId || !order.customer) continue;
    const account: Draft = byCustomer.get(order.customerId) ?? {
      customerId: order.customerId,
      name: order.customer.name,
      totalCents: 0,
      orderIds: [],
      orderNumbers: [],
      items: [],
      inPreparation: { count: 0, totalCents: 0 },
      lines: new Map(),
    };
    byCustomer.set(order.customerId, account);

    const orderCents = toCents(order.total);
    if (order.status !== "DELIVERED") {
      account.inPreparation.count++;
      account.inPreparation.totalCents += orderCents;
      continue;
    }
    account.totalCents += orderCents;
    account.orderIds.push(order.id);
    account.orderNumbers.push({
      number: order.number,
      eventName: order.event.name,
      current: order.eventId === currentEventId,
    });
    for (const item of order.items) {
      const description = describeItem(item);
      const line = account.lines.get(description) ?? { description, quantity: 0, totalCents: 0 };
      line.quantity += item.quantity;
      line.totalCents += item.quantity * toCents(item.unitPrice);
      account.lines.set(description, line);
    }
  }
  return [...byCustomer.values()]
    .filter((account) => account.orderIds.length > 0)
    .map(({ lines, ...account }) => ({
      ...account,
      items: [...lines.values()].sort((a, b) => b.quantity - a.quantity || a.description.localeCompare(b.description)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Tudo o que a tela de balcão precisa em uma única leitura. */
export async function getCounterSnapshot(db: PrismaClient): Promise<CounterSnapshot> {
  const event = await db.event.findFirst({ where: { status: "OPEN" } });

  const [settings, products, combos, orders, payLater] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.product.findMany({
      where: { active: true },
      include: { eventMenu: { where: event ? { eventId: event.id } : { eventId: { in: [] } } } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    db.combo.findMany({ where: { active: true }, include: { options: true }, orderBy: { name: "asc" } }),
    event
      ? db.order.findMany({
          where: { eventId: event.id },
          include: { items: { include: { components: true } } },
          orderBy: { number: "desc" },
        })
      : Promise.resolve([]),
    db.order.findMany({
      where: { paymentMethod: "PAY_LATER", paymentStatus: "PENDING", status: { not: "CANCELED" } },
      include: { ...itemsInclude, event: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  // Saldo por conta (inclui pedidos em preparo) para sugerir o nome no novo pedido.
  const balances = new Map<string, OpenAccount>();
  for (const order of payLater) {
    if (!order.customerId || !order.customer) continue;
    const account = balances.get(order.customerId) ?? {
      id: order.customerId,
      name: order.customer.name,
      key: customerKey(order.customer.name),
      balanceCents: 0,
    };
    account.balanceCents += toCents(order.total);
    balances.set(order.customerId, account);
  }

  return {
    event: event && { id: event.id, name: event.name, date: event.date.toISOString().slice(0, 10) },
    settings: {
      pixKey: settings?.pixKey ?? "",
      pixMerchant: settings?.pixMerchant ?? "CANTINA G7",
      pixCity: settings?.pixCity ?? "SAO PAULO",
    },
    products: products.map((product) => {
      const menuItem = product.eventMenu[0];
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        priceCents: toCents(product.price),
        countable: product.stockControl === "COUNTABLE",
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        inMenu: product.category === "DRINK" || Boolean(menuItem),
        soldOut: menuItem?.soldOut ?? false,
      };
    }),
    combos: combos.map((combo) => ({
      id: combo.id,
      name: combo.name,
      optionIds: combo.options.map((option) => option.productId),
    })),
    orders: orders.map((order) => ({
      id: order.id,
      number: order.number,
      customerName: order.customerName,
      status: order.status,
      isReservation: order.isReservation,
      totalCents: toCents(order.total),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      summary: order.items.map((item) => `${item.quantity}x ${describeItem(item)}`).join(", "),
    })),
    accounts: [...balances.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    receivables: buildReceivables(payLater, event?.id),
  };
}
