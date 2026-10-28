import { z } from "zod";

const id = z.uuid();
const name = (max: number) => z.string().trim().min(1, "Obrigatório").max(max);
const cents = z.number().int("Valor inválido").min(0, "Valor inválido").max(10_000_000, "Valor inválido");
const quantity = z.number().int("Quantidade inválida").min(0, "Quantidade inválida").max(99_999);

export const productSchema = z
  .object({
    name: name(80),
    category: z.enum(["SNACK", "DRINK"]),
    priceCents: cents,
    countable: z.boolean(),
    lowStockThreshold: quantity.nullable().default(null),
    active: z.boolean().default(true),
  })
  .transform((input) => ({ ...input, lowStockThreshold: input.countable ? input.lowStockThreshold : null }));
export type ProductInput = z.input<typeof productSchema>;

export const createProductSchema = z.object({
  product: productSchema,
  /** Saldo inicial (somente produtos contáveis). */
  initialStock: quantity.default(0),
});
export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = z.object({ id, product: productSchema });
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const stockCountSchema = z.object({ productId: id, quantity });

export const comboSchema = z.object({
  name: name(80),
  optionIds: z.array(id).min(2, "Escolha ao menos um lanche e uma bebida"),
  active: z.boolean().default(true),
});
export type ComboInput = z.input<typeof comboSchema>;

export const settingsSchema = z.object({
  pixKey: name(140),
  // Limites do BR Code (EMV): nome até 25 e cidade até 15 caracteres.
  pixMerchant: name(25),
  pixCity: name(15),
  receiptHeader: name(32),
});
export type SettingsInput = z.input<typeof settingsSchema>;

/** Quita os pedidos indicados (um pedido ou a conta inteira da pessoa). */
export const settleSchema = z.object({ orderIds: z.array(id).min(1).max(200), method: z.enum(["PIX", "CASH"]) });
export type SettleInput = z.input<typeof settleSchema>;

export const closeEventSchema = z.object({
  eventId: id,
  countedCashCents: cents,
  notes: z.string().trim().max(500).optional(),
});
export type CloseEventInput = z.input<typeof closeEventSchema>;

export const userSchema = z.object({
  name: name(120),
  role: z.enum(["ADMIN", "OPERATOR"]),
});

export const createUserSchema = userSchema.extend({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = userSchema.extend({ id, active: z.boolean() });
export type UpdateUserInput = z.input<typeof updateUserSchema>;
