"use client";

import { HandCoins } from "lucide-react";
import { useState } from "react";

import { Button, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { customerKey } from "@/lib/customer";
import { formatBRL, parseCents } from "@/lib/money";
import type { CounterSnapshot, Receivable } from "@/server/counter/queries";

import { receivePaymentAction } from "../actions";
import { PixQr } from "./pix-qr";

type Method = "PIX" | "CASH";

function ReceiveForm({
  account,
  settings,
  onDone,
}: {
  account: Receivable;
  settings: CounterSnapshot["settings"];
  onDone: (message: string) => void;
}) {
  const { pending, error, run } = useAction();
  const [cash, setCash] = useState("");
  const received = cash.trim() ? parseCents(cash) : null;
  const change = received === null ? null : received - account.totalCents;

  function receive(method: Method) {
    const label = method === "PIX" ? "Pix" : "dinheiro";
    if (!window.confirm(`Receber ${formatBRL(account.totalCents)} de ${account.name} em ${label}?`)) return;
    run(
      () => receivePaymentAction({ orderIds: account.orderIds, method }),
      () => onDone(`Conta de ${account.name} recebida: ${formatBRL(account.totalCents)} em ${label}.`),
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <PixQr
        pixKey={settings.pixKey}
        merchantName={settings.pixMerchant}
        merchantCity={settings.pixCity}
        amountCents={account.totalCents}
      />
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          inputMode="decimal"
          placeholder="Dinheiro recebido (opcional)"
          value={cash}
          onChange={(event) => setCash(event.target.value)}
          aria-label={`Dinheiro recebido de ${account.name}`}
        />
        {change !== null && (
          <span className={`shrink-0 text-sm font-semibold ${change < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {change < 0 ? `Faltam ${formatBRL(-change)}` : `Troco ${formatBRL(change)}`}
          </span>
        )}
      </div>
      <ErrorText error={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" className="min-h-12" disabled={pending} onClick={() => receive("PIX")}>
          Recebi no Pix
        </Button>
        <Button
          variant="primary"
          className="min-h-12"
          disabled={pending || (change !== null && change < 0)}
          onClick={() => receive("CASH")}
        >
          Recebi em dinheiro
        </Button>
      </div>
    </div>
  );
}

function ReceivableCard({
  account,
  settings,
  onDone,
}: {
  account: Receivable;
  settings: CounterSnapshot["settings"];
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const previous = account.orderNumbers.filter((order) => !order.current).length;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-sky-300 bg-white p-4 dark:border-sky-500/40 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-lg font-bold">{account.name}</p>
          <p className="text-xs opacity-60">
            {account.orderNumbers.length} pedido(s) já retirado(s):{" "}
            {account.orderNumbers
              .filter((order) => order.current)
              .map((order) => `#${String(order.number).padStart(3, "0")}`)
              .join(", ")}
            {previous > 0 && `${previous < account.orderNumbers.length ? " + " : ""}${previous} de eventos anteriores`}
          </p>
        </div>
        <span className="shrink-0 text-2xl font-bold tabular-nums">{formatBRL(account.totalCents)}</span>
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {account.items.map((item) => (
          <li key={item.description} className="flex justify-between gap-2">
            <span>
              <span className="font-semibold tabular-nums">{item.quantity}x</span> {item.description}
            </span>
            <span className="shrink-0 tabular-nums opacity-70">{formatBRL(item.totalCents)}</span>
          </li>
        ))}
      </ul>

      {account.inPreparation.count > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          + {account.inPreparation.count} pedido(s) ainda não retirado(s) ({formatBRL(account.inPreparation.totalCents)}
          ): entra(m) aqui quando for(em) entregue(s).
        </p>
      )}

      {open ? (
        <ReceiveForm account={account} settings={settings} onDone={onDone} />
      ) : (
        <Button variant="primary" className="min-h-12" onClick={() => setOpen(true)}>
          <HandCoins size={18} /> Receber {formatBRL(account.totalCents)}
        </Button>
      )}
    </li>
  );
}

/** Aba "A receber": o que cada pessoa já pegou para pagar depois, somado por pessoa. */
export function Receivables({
  receivables,
  settings,
  onDone,
}: {
  receivables: Receivable[];
  settings: CounterSnapshot["settings"];
  onDone: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const term = customerKey(search);
  const visible = term ? receivables.filter((account) => customerKey(account.name).includes(term)) : receivables;
  const totalCents = visible.reduce((sum, account) => sum + account.totalCents, 0);

  return (
    <section className="flex flex-col gap-3" aria-label="A receber">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} sm:!w-72`}
          placeholder="Buscar pelo nome"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar pelo nome"
        />
        <p className="ml-auto text-sm">
          {visible.length} pessoa(s) · <span className="font-bold">{formatBRL(totalCents)}</span>
        </p>
      </div>

      {visible.length === 0 && (
        <p className="py-10 text-center text-sm opacity-60">
          Ninguém com pedido retirado para pagar depois. Pedidos “Depois” aparecem aqui ao serem entregues.
        </p>
      )}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((account) => (
          <ReceivableCard key={account.customerId} account={account} settings={settings} onDone={onDone} />
        ))}
      </ul>
    </section>
  );
}
