import type { PrismaClient } from "@/generated/prisma/client";
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

export type CounterSnapshot = {
  event: { id: string; name: string; date: string } | null;
  settings: { pixKey: string; pixMerchant: string; pixCity: string };
  products: CounterProduct[];
  combos: { id: string; name: string; optionIds: string[] }[];
  orders: CounterOrder[];
  accounts: OpenAccount[];
};

/** Tudo o que a tela de balcão precisa em uma única leitura. */
export async function getCounterSnapshot(db: PrismaClient): Promise<CounterSnapshot> {
  const event = await db.event.findFirst({ where: { status: "OPEN" } });

  const [settings, products, combos, orders, balances] = await Promise.all([
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
    db.order.groupBy({
      by: ["customerId"],
      where: { paymentMethod: "PAY_LATER", paymentStatus: "PENDING", status: { not: "CANCELED" } },
      _sum: { total: true },
    }),
  ]);
  const customers = await db.customer.findMany({
    where: { id: { in: balances.flatMap((row) => (row.customerId ? [row.customerId] : [])) } },
  });
  const balanceById = new Map(balances.map((row) => [row.customerId, toCents(row._sum.total ?? 0)]));

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
      summary: order.items
        .map((item) => {
          const parts = item.components.map((component) => component.description).join(" + ");
          return `${item.quantity}x ${item.description}${parts ? ` (${parts})` : ""}`;
        })
        .join(", "),
    })),
    accounts: customers
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        key: customer.nameKey,
        balanceCents: balanceById.get(customer.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
