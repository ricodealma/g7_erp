import { z } from "zod";

const id = z.uuid();
const name = (max: number) => z.string().trim().min(1, "Obrigatório").max(max);

export const createOrderSchema = z
  .object({
    customerName: name(80),
    isReservation: z.boolean().default(false),
    notes: z.string().trim().max(280).optional(),
    paymentMethod: z.enum(["PIX", "CASH", "PAY_LATER"]),
    amountReceivedCents: z.number().int().nonnegative().optional(),
    lines: z
      .array(z.object({ productId: id, quantity: z.number().int().min(1).max(99) }))
      .min(1, "Adicione ao menos um item"),
  })
  .refine((input) => input.paymentMethod === "CASH" || input.amountReceivedCents === undefined, {
    message: "Valor recebido só se aplica a dinheiro",
    path: ["amountReceivedCents"],
  });
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const orderStatusSchema = z.object({
  orderId: id,
  status: z.enum(["PENDING", "READY", "DELIVERED"]),
});

export const openEventSchema = z.object({
  name: name(80),
  date: z.iso.date(),
  snackIds: z.array(id).default([]),
});
export type OpenEventInput = z.input<typeof openEventSchema>;

export const restockSchema = z.object({
  productId: id,
  quantity: z.number().int().min(1).max(9999),
});

export const menuItemSchema = z.object({
  productId: id,
  inMenu: z.boolean().optional(),
  soldOut: z.boolean().optional(),
});

export const quickSnackSchema = z
  .object({
    name: name(80),
    priceCents: z.number().int().min(0).max(100_000),
    countable: z.boolean(),
    stockQuantity: z.number().int().min(0).max(9999).optional(),
  })
  .refine((input) => !input.countable || input.stockQuantity !== undefined, {
    message: "Informe a quantidade",
    path: ["stockQuantity"],
  });
export type QuickSnackInput = z.input<typeof quickSnackSchema>;
