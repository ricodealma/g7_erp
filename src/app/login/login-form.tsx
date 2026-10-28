"use client";

import { useActionState } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { signInAction, type SignInState } from "./actions";

const REASONS: Record<string, string> = {
  "sem-acesso": "Sua sessão terminou ou seu usuário não tem acesso. Entre novamente.",
};

export function LoginForm({ reason }: { reason?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, { error: null, email: "" });
  const message = state.error ?? (reason ? REASONS[reason] : null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="E-mail">
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          autoFocus
        />
      </Field>
      <Field label="Senha">
        <input className={inputClass} type="password" name="password" autoComplete="current-password" required />
      </Field>
      {message && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300"
        >
          {message}
        </p>
      )}
      <Button type="submit" variant="primary" className="min-h-12 text-base" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
