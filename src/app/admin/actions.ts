"use server";

import { z } from "zod";

import { run } from "@/server/action-result";
import { createProduct, saveCombo, setStockCount, updateProduct, updateSettings } from "@/server/admin/catalog";
import { closeEvent, settlePayment } from "@/server/admin/finance";
import type {
  CloseEventInput,
  ComboInput,
  CreateProductInput,
  CreateUserInput,
  SettingsInput,
  SettleInput,
  UpdateProductInput,
  UpdateUserInput,
} from "@/server/admin/schemas";
import { createUser, resetPassword, updateUser } from "@/server/admin/users";
import { authorize } from "@/server/auth";
import { db } from "@/server/db";
import { createAuthAdmin } from "@/server/supabase-admin";

// Toda action valida sessão e permissão (RF-15/RF-16): Server Actions são endpoints POST públicos.

export async function settlePaymentAction(input: SettleInput) {
  return run(async () => {
    const viewer = await authorize("finance.settle");
    await settlePayment(db, input, viewer.id);
  });
}

export async function closeEventAction(input: CloseEventInput) {
  return run(async () => {
    const viewer = await authorize("event.close");
    return closeEvent(db, input, viewer.id);
  });
}

export async function createProductAction(input: CreateProductInput) {
  return run(async () => {
    const viewer = await authorize("catalog.manage");
    await createProduct(db, input, viewer.id);
  });
}

export async function updateProductAction(input: UpdateProductInput) {
  return run(async () => {
    await authorize("catalog.manage");
    await updateProduct(db, input);
  });
}

export async function setStockCountAction(productId: string, quantity: number) {
  return run(async () => {
    const viewer = await authorize("catalog.manage");
    await setStockCount(db, { productId, quantity }, viewer.id);
  });
}

export async function saveComboAction(input: ComboInput & { id?: string }) {
  return run(async () => {
    await authorize("catalog.manage");
    await saveCombo(db, { ...input, id: input.id === undefined ? undefined : z.uuid().parse(input.id) });
  });
}

export async function updateSettingsAction(input: SettingsInput) {
  return run(async () => {
    await authorize("settings.manage");
    await updateSettings(db, input);
  });
}

export async function createUserAction(input: CreateUserInput) {
  return run(async () => {
    await authorize("users.manage");
    const { password } = await createUser(db, createAuthAdmin(), input);
    return { password };
  });
}

export async function updateUserAction(input: UpdateUserInput) {
  return run(async () => {
    const viewer = await authorize("users.manage");
    await updateUser(db, input, viewer.id);
  });
}

export async function resetPasswordAction(userId: string) {
  return run(async () => {
    await authorize("users.manage");
    return resetPassword(db, createAuthAdmin(), z.uuid().parse(userId));
  });
}
