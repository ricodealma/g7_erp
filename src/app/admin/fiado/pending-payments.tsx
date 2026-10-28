"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { customerKey } from "@/lib/customer";
import { formatBRL } from "@/lib/money";
import type { PendingAccount } from "@/server/admin/finance";

import { settlePaymentsAction } from "../actions";
import { Card, formatDate } from "../_components/shared";

type Method = "PIX" | "CASH";
const METHOD_LABEL: Record<Method, string> = { PIX: "Pix", CASH: "dinheiro" };

function AccountRow({
  account,
  pending,
  onSettle,
}: {
  account: PendingAccount;
  pending: boolean;
  onSettle: (orderIds: string[], totalCents: number, method: Method, what: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const allIds = account.orders.map((order) => order.id);
  const several = account.orders.length > 1;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={18} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0">
            <span className="font-medium">{account.name}</span>{" "}
            <span className="font-bold tabular-nums">{formatBRL(account.totalCents)}</span>
            <span className="block text-xs opacity-60">
              {account.orders.length} pedido(s) · desde {formatDate(account.orders[0].eventDate)}
            </span>
          </span>
        </button>
        <div className="flex gap-2">
          {(["PIX", "CASH"] as const).map((method) => (
            <Button
              key={method}
              variant="success"
              disabled={pending}
              onClick={() => onSettle(allIds, account.totalCents, method, `a conta de ${account.name}`)}
            >
              {several ? `Quitar tudo (${METHOD_LABEL[method]})` : method === "PIX" ? "Pix" : "Dinheiro"}
            </Button>
          ))}
        </div>
      </div>
      {open && (
        <ul className="ml-7 flex flex-col gap-2 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
          {account.orders.map((order) => {
            const label = `#${String(order.number).padStart(3, "0")}`;
            return (
              <li key={order.id} className="flex flex-wrap items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p>
                    {label} · {order.eventName} ({formatDate(order.eventDate)}) ·{" "}
                    <span className="font-semibold tabular-nums">{formatBRL(order.totalCents)}</span>
                  </p>
                  <p className="text-xs opacity-60">{order.summary}</p>
                </div>
                {several && (
                  <div className="flex gap-1">
                    {(["PIX", "CASH"] as const).map((method) => (
                      <Button
                        key={method}
                        variant="ghost"
                        className="!min-h-9 !px-2 text-xs"
                        disabled={pending}
                        onClick={() =>
                          onSettle([order.id], order.totalCents, method, `o pedido ${label} de ${account.name}`)
                        }
                      >
                        Só este ({METHOD_LABEL[method]})
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function PendingPayments({ accounts }: { accounts: PendingAccount[] }) {
  const { pending, error, run } = useAction();
  const [search, setSearch] = useState("");
  const term = customerKey(search);
  const visible = term ? accounts.filter((account) => customerKey(account.name).includes(term)) : accounts;
  const totalCents = visible.reduce((sum, account) => sum + account.totalCents, 0);

  function settle(orderIds: string[], cents: number, method: Method, what: string) {
    if (!window.confirm(`Quitar ${formatBRL(cents)} (${what}) em ${METHOD_LABEL[method]}?`)) return;
    run(() => settlePaymentsAction({ orderIds, method }));
  }

  if (accounts.length === 0) {
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
          {visible.length} conta(s) · <span className="font-bold">{formatBRL(totalCents)}</span>
        </p>
      </div>
      <ErrorText error={error} />
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {visible.map((account) => (
          <AccountRow key={account.customerId} account={account} pending={pending} onSettle={settle} />
        ))}
      </ul>
    </Card>
  );
}
