"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { ReceiptData } from "@/lib/receipt";
import {
  closeEvent,
  createQuickSnack,
  openEvent,
  restock,
  updateMenuItem,
} from "@/server/counter/catalog";
import { DomainError } from "@/server/counter/errors";
import { cancelOrder, createOrder, getReceiptData, setOrderStatus } from "@/server/counter/orders";
import type { CreateOrderInput, OpenEventInput, QuickSnackInput } from "@/server/counter/schemas";
import { db } from "@/server/db";

// TODO(auth): validar sessão e perfil (RF-15) em cada action quando o Supabase Auth entrar.

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(task: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await task();
    refresh();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    console.error(error);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<ActionResult<{ id: string; number: number; receipt: ReceiptData }>> {
  return run(async () => {
    const order = await createOrder(db, input);
    return { ...order, receipt: await getReceiptData(db, order.id) };
  });
}

export async function setOrderStatusAction(orderId: string, status: "PENDING" | "READY" | "DELIVERED") {
  return run(() => setOrderStatus(db, { orderId, status }));
}

export async function cancelOrderAction(orderId: string) {
  return run(() => cancelOrder(db, z.uuid().parse(orderId)));
}

export async function getReceiptAction(orderId: string): Promise<ActionResult<ReceiptData>> {
  try {
    return { ok: true, data: await getReceiptData(db, z.uuid().parse(orderId)) };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível carregar o cupom." };
  }
}

export async function openEventAction(input: OpenEventInput) {
  return run(async () => {
    await openEvent(db, input);
  });
}

export async function closeEventAction() {
  return run(() => closeEvent(db));
}

export async function updateMenuItemAction(input: { productId: string; inMenu?: boolean; soldOut?: boolean }) {
  return run(() => updateMenuItem(db, input));
}

export async function createQuickSnackAction(input: QuickSnackInput) {
  return run(async () => {
    await createQuickSnack(db, input);
  });
}

export async function restockAction(productId: string, quantity: number) {
  return run(() => restock(db, { productId, quantity }));
}
