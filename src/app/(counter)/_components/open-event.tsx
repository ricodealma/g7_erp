"use client";

import { useState, useTransition } from "react";

import { formatBRL } from "@/lib/money";
import type { CounterProduct } from "@/server/counter/queries";

import { openEventAction } from "../actions";
import { Button, Field, inputClass } from "@/components/ui";

function today() {
  // Data local de São Paulo no formato AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function OpenEvent({ snacks }: { snacks: CounterProduct[] }) {
  const [name, setName] = useState("Culto");
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await openEventAction({ name, date, snackIds: selected });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 p-4">
      <div>
        <h1 className="text-2xl font-bold">Abrir evento</h1>
        <p className="text-sm opacity-70">As vendas e a numeração dos pedidos ficam vinculadas ao evento.</p>
      </div>
      <Field label="Nome do evento">
        <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      </Field>
      <Field label="Data">
        <input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Lanches do dia</legend>
        {snacks.map((snack) => (
          <label key={snack.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-amber-500"
              checked={selected.includes(snack.id)}
              onChange={(event) =>
                setSelected(event.target.checked ? [...selected, snack.id] : selected.filter((id) => id !== snack.id))
              }
            />
            <span className="flex-1">{snack.name}</span>
            <span className="text-sm opacity-70">{formatBRL(snack.priceCents)}</span>
          </label>
        ))}
        <p className="text-xs opacity-60">Novos lanches podem ser cadastrados depois, em “Cardápio”.</p>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        className="min-h-14 text-lg"
        disabled={pending || !name.trim() || !date}
        onClick={submit}
      >
        {pending ? "Abrindo…" : "Abrir evento"}
      </Button>
    </main>
  );
}
