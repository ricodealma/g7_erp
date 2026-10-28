import "server-only";

import { refresh } from "next/cache";
import { z } from "zod";

import { DomainError } from "./counter/errors";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Executa uma Server Action convertendo erros esperados em mensagem para a tela. */
export async function run<T>(task: () => Promise<T>, { mutates = true } = {}): Promise<ActionResult<T>> {
  try {
    const data = await task();
    if (mutates) refresh();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    console.error(error);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}
