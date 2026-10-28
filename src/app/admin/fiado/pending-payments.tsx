"use client";

import { useState } from "react";

import { Button, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { formatBRL } from "@/lib/money";
import type { PendingPayment } from "@/server/admin/finance";

import { settlePaymentAction } from "../actions";
import { Card, formatDate } from "../_components/shared";

export function PendingPayments({ payments }: { payments: PendingPayment[] }) {
  const { pending, error, run } = useAction();
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = term
    ? payments.filter((payment) => payment.customerName.toLocaleLowerCase("pt-BR").includes(term))
    : payments;
  const totalCents = visible.reduce((sum, payment) => sum + payment.totalCents, 0);

  function settle(payment: PendingPayment, method: "PIX" | "CASH") {
    const label = method === "PIX" ? "Pix" : "dinheiro";
    if (!window.confirm(`Quitar ${formatBRL(payment.totalCents)} de ${payment.customerName} em ${label}?`)) return;
    run(() => settlePaymentAction({ orderId: payment.id, method }));
  }

  if (payments.length === 0) {
    return (
      <Card>
        <p className="text-sm opacity-70">Nenhum fiado em aberto.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} sm:!w-72`}
          placeholder="Buscar pelo nome"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar pelo nome"
        />
        <p className="ml-auto text-sm">
          {visible.length} pedido(s) · <span className="font-bold">{formatBRL(totalCents)}</span>
        </p>
      </div>
      <ErrorText error={error} />
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {visible.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {payment.customerName} <span className="font-bold tabular-nums">{formatBRL(payment.totalCents)}</span>
              </p>
              <p className="text-xs opacity-60">
                #{String(payment.number).padStart(3, "0")} · {payment.eventName} ({formatDate(payment.eventDate)})
              </p>
              <p className="truncate text-xs opacity-60">{payment.summary}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="success" disabled={pending} onClick={() => settle(payment, "PIX")}>
                Pix
              </Button>
              <Button variant="success" disabled={pending} onClick={() => settle(payment, "CASH")}>
                Dinheiro
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
