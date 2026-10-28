import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { fromCents, toCents } from "@/lib/money";

import { DomainError } from "../counter/errors";
import {
  comboSchema,
  createProductSchema,
  settingsSchema,
  stockCountSchema,
  updateProductSchema,
  type ComboInput,
  type CreateProductInput,
  type SettingsInput,
  type UpdateProductInput,
} from "./schemas";

function uniqueName<T>(promise: Promise<T>, name: string): Promise<T> {
  return promise.catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError(`Já existe um cadastro chamado ${name}.`);
    }
    throw error;
  });
}

async function openEventId(db: Prisma.TransactionClient) {
  const event = await db.event.findFirst({ where: { status: "OPEN" }, select: { id: true } });
  return event?.id;
}

// ------------------------------------------------------------------ Produtos

export type AdminProduct = {
  id: string;
  name: string;
  category: "SNACK" | "DRINK";
  priceCents: number;
  countable: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  active: boolean;
};

export async function listProducts(db: PrismaClient): Promise<AdminProduct[]> {
  const products = await db.product.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    priceCents: toCents(product.price),
    countable: product.stockControl === "COUNTABLE",
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    active: product.active,
  }));
}

/** Cadastro de produto (RF-16). O saldo inicial entra como movimentação de ajuste. */
export async function createProduct(db: PrismaClient, rawInput: CreateProductInput, createdById?: string) {
  const { product, initialStock } = createProductSchema.parse(rawInput);
  return db.$transaction(async (tx) => {
    const created = await uniqueName(
      tx.product.create({
        data: {
          name: product.name,
          category: product.category,
          price: fromCents(product.priceCents),
          stockControl: product.countable ? "COUNTABLE" : "UNCOUNTABLE",
          stockQuantity: product.countable ? initialStock : null,
          lowStockThreshold: product.lowStockThreshold,
          active: product.active,
        },
        select: { id: true },
      }),
      product.name,
    );
    if (product.countable && initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: created.id,
          eventId: await openEventId(tx),
          type: "ADJUSTMENT",
          quantity: initialStock,
          createdById,
        },
      });
    }
    return created;
  });
}

/**
 * Edita o produto. Trocar o tipo de controle zera o saldo (contável) ou o descarta
 * (não contável), mantendo a regra do CHECK "products_stock_matches_control".
 */
export async function updateProduct(db: PrismaClient, rawInput: UpdateProductInput) {
  const { id, product } = updateProductSchema.parse(rawInput);
  const current = await db.product.findUnique({ where: { id }, select: { stockControl: true } });
  if (!current) throw new DomainError("Produto não encontrado.");

  const stockControl = product.countable ? "COUNTABLE" : "UNCOUNTABLE";
  await uniqueName(
    db.product.update({
      where: { id },
      data: {
        name: product.name,
        category: product.category,
        price: fromCents(product.priceCents),
        stockControl,
        lowStockThreshold: product.lowStockThreshold,
        active: product.active,
        ...(current.stockControl !== stockControl && { stockQuantity: product.countable ? 0 : null }),
      },
    }),
    product.name,
  );
}

/**
 * Contagem de inventário: define o saldo real e registra a diferença como ajuste.
 * Usa o saldo lido como condição para não sobrescrever uma venda concorrente.
 */
export async function setStockCount(
  db: PrismaClient,
  rawInput: { productId: string; quantity: number },
  createdById?: string,
) {
  const { productId, quantity } = stockCountSchema.parse(rawInput);
  await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.stockControl !== "COUNTABLE" || product.stockQuantity === null) {
      throw new DomainError("Produto sem controle de estoque.");
    }
    const delta = quantity - product.stockQuantity;
    if (delta === 0) return;

    const { count } = await tx.product.updateMany({
      where: { id: productId, stockQuantity: product.stockQuantity },
      data: { stockQuantity: quantity },
    });
    if (count === 0) throw new DomainError("O estoque mudou durante a contagem. Confira e tente novamente.");
    await tx.stockMovement.create({
      data: { productId, eventId: await openEventId(tx), type: "ADJUSTMENT", quantity: delta, createdById },
    });
  });
}

// ------------------------------------------------------------------ Combos

export type AdminCombo = { id: string; name: string; priceCents: number; optionIds: string[]; active: boolean };

export async function listCombos(db: PrismaClient): Promise<AdminCombo[]> {
  const combos = await db.combo.findMany({
    include: { options: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return combos.map((combo) => ({
    id: combo.id,
    name: combo.name,
    priceCents: toCents(combo.price),
    optionIds: combo.options.map((option) => option.productId),
    active: combo.active,
  }));
}

/** Combo = 1 lanche + 1 bebida entre as opções; exige ao menos uma opção de cada. */
async function validateComboOptions(db: Prisma.TransactionClient, optionIds: string[]) {
  const products = await db.product.findMany({ where: { id: { in: optionIds } }, select: { category: true } });
  if (products.length !== new Set(optionIds).size) throw new DomainError("Produto do combo não encontrado.");
  const categories = new Set(products.map((product) => product.category));
  if (!categories.has("SNACK") || !categories.has("DRINK")) {
    throw new DomainError("Escolha ao menos um lanche e uma bebida");
  }
}

/** Cria (sem id) ou edita um combo de preço fixo (RF-16). */
export async function saveCombo(db: PrismaClient, rawInput: ComboInput & { id?: string }) {
  const input = comboSchema.parse(rawInput);
  const optionIds = [...new Set(input.optionIds)];
  const data = { name: input.name, price: fromCents(input.priceCents), active: input.active };

  return db.$transaction(async (tx) => {
    await validateComboOptions(tx, optionIds);
    const options = { create: optionIds.map((productId) => ({ productId })) };
    if (!rawInput.id) {
      return uniqueName(tx.combo.create({ data: { ...data, options }, select: { id: true } }), input.name);
    }
    return uniqueName(
      tx.combo.update({
        where: { id: rawInput.id },
        data: { ...data, options: { deleteMany: {}, ...options } },
        select: { id: true },
      }),
      input.name,
    );
  });
}

// ------------------------------------------------------------------ Configurações

export async function getSettings(db: PrismaClient): Promise<SettingsInput> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return {
    pixKey: settings?.pixKey ?? "",
    pixMerchant: settings?.pixMerchant ?? "",
    pixCity: settings?.pixCity ?? "",
    receiptHeader: settings?.receiptHeader ?? "",
  };
}

export async function updateSettings(db: PrismaClient, rawInput: SettingsInput) {
  const data = settingsSchema.parse(rawInput);
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}
