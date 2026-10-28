"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/server/action-result";

/** Executa uma Server Action com estado de carregamento e mensagem de erro. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(task: () => Promise<ActionResult<T>>, onSuccess?: (data: T) => void) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (result.ok) onSuccess?.(result.data);
      else setError(result.error);
    });
  return { pending, error, setError, run };
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  ) : null;
}
