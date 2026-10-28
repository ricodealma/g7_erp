import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import type { ProductCategory, StockControl } from "../src/generated/prisma/enums";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("DIRECT_URL não definida");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type SeedProduct = {
  name: string;
  category: ProductCategory;
  price: string;
  stockControl: StockControl;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
};

const products: SeedProduct[] = [
  {
    name: "Pitchulinha",
    category: "DRINK",
    price: "3.00",
    stockControl: "COUNTABLE",
    stockQuantity: 0,
    lowStockThreshold: 6,
  },
  {
    name: "Refri Lata",
    category: "DRINK",
    price: "5.00",
    stockControl: "COUNTABLE",
    stockQuantity: 0,
    lowStockThreshold: 6,
  },
  { name: "Suco", category: "DRINK", price: "4.00", stockControl: "COUNTABLE", stockQuantity: 0, lowStockThreshold: 6 },
  {
    name: "Água com gás",
    category: "DRINK",
    price: "4.00",
    stockControl: "COUNTABLE",
    stockQuantity: 0,
    lowStockThreshold: 6,
  },
  {
    name: "Pizza de Calabresa",
    category: "SNACK",
    price: "7.50",
    stockControl: "COUNTABLE",
    stockQuantity: 0,
    lowStockThreshold: 3,
  },
  {
    name: "Pão com Pernil",
    category: "SNACK",
    price: "7.00",
    stockControl: "UNCOUNTABLE",
    stockQuantity: null,
    lowStockThreshold: null,
  },
  {
    name: "Pastel de Frango",
    category: "SNACK",
    price: "7.00",
    stockControl: "UNCOUNTABLE",
    stockQuantity: null,
    lowStockThreshold: null,
  },
];

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      pixKey: "jovens.cdc.7@gmail.com",
      pixMerchant: "CANTINA G7",
      pixCity: "SAO PAULO",
      receiptHeader: "CANTINA G7 - ERP",
    },
  });

  // Upsert por nome sem sobrescrever preço/estoque já ajustados pelo admin.
  const seeded = await Promise.all(
    products.map((product) => db.product.upsert({ where: { name: product.name }, update: {}, create: product })),
  );

  const combo = await db.combo.upsert({
    where: { name: "Combo Lanche do Dia" },
    update: {},
    create: { name: "Combo Lanche do Dia", price: "10.00" },
  });

  await db.comboOption.createMany({
    data: seeded.map((product) => ({ comboId: combo.id, productId: product.id })),
    skipDuplicates: true,
  });

  console.log(`Seed concluído: ${seeded.length} produtos, 1 combo, configurações.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
