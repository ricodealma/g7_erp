import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { DEFAULT_TEST_DATABASE_URL } from "./global-setup";

export function createTestDb() {
  const connectionString = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const TABLES = [
  "stock_movements",
  "order_item_components",
  "order_items",
  "orders",
  "event_menu_items",
  "events",
  "combo_options",
  "combos",
  "products",
  "settings",
  "profiles",
];

/** Banco limpo + catálogo mínimo para cada teste. */
export async function seedFixtures(db: PrismaClient) {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(", ")} CASCADE`);

  await db.settings.create({
    data: { pixKey: "teste@pix.com", pixMerchant: "CANTINA", pixCity: "SAO PAULO", receiptHeader: "CANTINA TESTE" },
  });

  const [pizza, pernil, macarrao, refri, pitchula] = await Promise.all([
    db.product.create({
      data: { name: "Pizza", category: "SNACK", price: "7.50", stockControl: "COUNTABLE", stockQuantity: 5, lowStockThreshold: 1 },
    }),
    db.product.create({ data: { name: "Pão com Pernil", category: "SNACK", price: "7.00", stockControl: "UNCOUNTABLE" } }),
    db.product.create({ data: { name: "Macarrão", category: "SNACK", price: "12.00", stockControl: "UNCOUNTABLE" } }),
    db.product.create({
      data: { name: "Refri Lata", category: "DRINK", price: "5.00", stockControl: "COUNTABLE", stockQuantity: 10, lowStockThreshold: 2 },
    }),
    db.product.create({
      data: { name: "Pitchulinha", category: "DRINK", price: "3.00", stockControl: "COUNTABLE", stockQuantity: 2, lowStockThreshold: 1 },
    }),
  ]);

  const combo = await db.combo.create({
    data: {
      name: "Combo Lanche do Dia",
      price: "10.00",
      options: { create: [pizza, pernil, refri, pitchula].map((product) => ({ productId: product.id })) },
    },
  });

  const event = await db.event.create({
    data: {
      name: "Culto Teste",
      date: new Date("2026-11-01T00:00:00Z"),
      menu: { create: [{ productId: pizza.id }, { productId: pernil.id }] },
    },
  });

  return { pizza, pernil, macarrao, refri, pitchula, combo, event };
}
