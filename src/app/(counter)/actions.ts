"use server";

import { z } from "zod";

import type { ReceiptData } from "@/lib/receipt";
import { run, type ActionResult } from "@/server/action-result";
import { settlePayments } from "@/server/admin/finance";
import type { SettleInput } from "@/server/admin/schemas";
import { authorize } from "@/server/auth";
import { createQuickSnack, openEvent, restock, updateMenuItem } from "@/server/counter/catalog";
import { accountBalanceCents, cancelOrder, createOrder, getReceiptData, setOrderStatus } from "@/server/counter/orders";
import type { CreateOrderInput, OpenEventInput, QuickSnackInput } from "@/server/counter/schemas";
import { db } from "@/server/db";

// Toda action valida sessão e permissão (RF-15): Server Actions são endpoints POST públicos.

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<ActionResult<{ id: string; number: number; receipt: ReceiptData; accountBalanceCents: number | null }>> {
  return run(async () => {
    const viewer = await authorize("order.create");
    const { customerId, ...order } = await createOrder(db, input, viewer.id);
    const [receipt, balance] = await Promise.all([
      getReceiptData(db, order.id),
      customerId ? accountBalanceCents(db, customerId) : null,
    ]);
    return { ...order, receipt, accountBalanceCents: balance };
  });
}

export async function setOrderStatusAction(orderId: string, status: "PENDING" | "READY" | "DELIVERED") {
  return run(async () => {
    await authorize("order.status");
    await setOrderStatus(db, { orderId, status });
  });
}

export async function cancelOrderAction(orderId: string) {
  return run(async () => {
    const viewer = await authorize("order.cancel");
    await cancelOrder(db, z.uuid().parse(orderId), viewer.id);
  });
}

/** Recebe a conta (ou parte dela) no balcão; o valor entra no caixa do evento aberto. */
export async function receivePaymentAction(input: SettleInput) {
  return run(async () => {
    const viewer = await authorize("payment.receive");
    await settlePayments(db, input, viewer.id);
  });
}

export async function getReceiptAction(orderId: string) {
  return run(
    async () => {
      await authorize("order.reprint");
      return getReceiptData(db, z.uuid().parse(orderId));
    },
    { mutates: false },
  );
}

export async function openEventAction(input: OpenEventInput) {
  return run(async () => {
    await authorize("event.open");
    await openEvent(db, input);
  });
}

export async function updateMenuItemAction(input: { productId: string; inMenu?: boolean; soldOut?: boolean }) {
  return run(async () => {
    if (input.inMenu !== undefined) await authorize("menu.edit");
    else await authorize("menu.soldOut");
    await updateMenuItem(db, input);
  });
}

export async function createQuickSnackAction(input: QuickSnackInput) {
  return run(async () => {
    await authorize("menu.edit");
    await createQuickSnack(db, input);
  });
}

export async function restockAction(productId: string, quantity: number) {
  return run(async () => {
    const viewer = await authorize("stock.restock");
    await restock(db, { productId, quantity }, viewer.id);
  });
}
