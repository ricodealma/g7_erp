"use client";

import { useState } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { formatBRL, parseCents } from "@/lib/money";

import { closeEventAction } from "../../actions";

/** Fechamento de caixa (RF-16): informa o dinheiro contado e encerra o evento. */
export function CloseEventForm({
  eventId,
  eventName,
  expectedCashCents,
  openOrderCount,
}: {
  eventId: string;
  eventName: string;
  expectedCashCents: number;
  openOrderCount: number;
}) {
  const { pending, error, run } = useAction();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const countedCents = parseCents(counted);
  const difference = countedCents === null ? null : countedCents - expectedCashCents;

  function submit() {
    if (countedCents === null) return;
    if (!window.confirm(`Encerrar o evento "${eventName}"? Depois disso não será possível vender nele.`)) return;
    run(() => closeEventAction({ eventId, countedCashCents: countedCents, notes }));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {openOrderCount > 0 && (
        <p className="text-sm text-red-600">
          Há {openOrderCount} pedido(s) não entregue(s). Entregue ou cancele no balcão antes de encerrar.
        </p>
      )}
      <Field label="Dinheiro contado no caixa (R$)">
        <input
          className={inputClass}
          inputMode="decimal"
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          placeholder="0,00"
        />
      </Field>
      {difference !== null && (
        <p
          className={`text-sm font-medium ${difference < 0 ? "text-red-600" : difference > 0 ? "text-emerald-600" : ""}`}
        >
          {difference === 0
            ? "Caixa confere."
            : `${difference < 0 ? "Falta" : "Sobra"} ${formatBRL(Math.abs(difference))}`}
        </p>
      )}
      <Field label="Observações (opcional)">
        <textarea
          className={`${inputClass} py-2`}
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      <Button variant="danger" disabled={pending || countedCents === null || openOrderCount > 0} onClick={submit}>
        {pending ? "Encerrando…" : "Fechar caixa e encerrar evento"}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}
