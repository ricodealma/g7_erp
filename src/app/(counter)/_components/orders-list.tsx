"use client";

import { Printer, Star } from "lucide-react";
import { useState, useTransition } from "react";

import { formatBRL } from "@/lib/money";
import type { CounterOrder } from "@/server/counter/queries";

import { cancelOrderAction, getReceiptAction, setOrderStatusAction } from "../actions";
import type { ReceiptData } from "@/lib/receipt";
import { Button } from "@/components/ui";

const STATUS = {
  AWAITING_CONFIRMATION: {
    label: "Aguardando",
    className: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
  },
  PENDING: { label: "Em preparo", className: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
  READY: { label: "Pronto", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200" },
  DELIVERED: { label: "Entregue", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  CANCELED: { label: "Cancelado", className: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-200" },
} as const;

const PAYMENT = { PIX: "Pix", CASH: "Dinheiro", PAY_LATER: "Pagar depois" } as const;

const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function isOpen(order: CounterOrder) {
  return order.status === "PENDING" || order.status === "READY" || order.status === "AWAITING_CONFIRMATION";
}

export function OrdersList({
  orders,
  onReprint,
  onError,
}: {
  orders: CounterOrder[];
  onReprint: (receipt: ReceiptData) => void;
  onError: (message: string) => void;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = (filter === "open" ? orders.filter(isOpen) : orders).toSorted((a, b) =>
    filter === "open" ? Number(b.isReservation) - Number(a.isReservation) || a.number - b.number : b.number - a.number,
  );

  function act(orderId: string, task: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>) {
    setBusyId(orderId);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) onError(result.error);
      setBusyId(null);
    });
  }

  function reprint(orderId: string) {
    act(orderId, async () => {
      const result = await getReceiptAction(orderId);
      if (result.ok) onReprint(result.data);
      return result;
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Pedidos">
      <div className="flex gap-2">
        <Button variant={filter === "open" ? "primary" : "secondary"} onClick={() => setFilter("open")}>
          Em aberto ({orders.filter(isOpen).length})
        </Button>
        <Button variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
          Histórico ({orders.length})
        </Button>
      </div>

      {visible.length === 0 && <p className="py-10 text-center text-sm opacity-60">Nenhum pedido aqui.</p>}

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((order) => {
          const busy = busyId === order.id;
          return (
            <li
              key={order.id}
              className={`flex flex-col gap-2 rounded-2xl border-2 bg-white p-4 dark:bg-zinc-900 ${
                order.isReservation && isOpen(order) ? "border-amber-500" : "border-zinc-200 dark:border-zinc-800"
              } ${busy ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold">
                    #{String(order.number).padStart(3, "0")} · <span className="break-words">{order.customerName}</span>
                  </p>
                  <p className="text-xs opacity-60">
                    {time.format(new Date(order.createdAt))} · {PAYMENT[order.paymentMethod]}
                    {order.paymentStatus === "PENDING" && " (pendente)"} · {formatBRL(order.totalCents)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${STATUS[order.status].className}`}
                >
                  {STATUS[order.status].label}
                </span>
              </div>

              {order.isReservation && (
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Star size={14} /> RESERVA
                </p>
              )}
              <p className="text-sm">{order.summary}</p>

              <div className="mt-auto flex flex-wrap gap-2">
                {order.status === "PENDING" && (
                  <Button
                    variant="success"
                    disabled={busy}
                    onClick={() => act(order.id, () => setOrderStatusAction(order.id, "READY"))}
                  >
                    Pronto
                  </Button>
                )}
                {(order.status === "PENDING" || order.status === "READY") && (
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => act(order.id, () => setOrderStatusAction(order.id, "DELIVERED"))}
                  >
                    Entregue
                  </Button>
                )}
                {order.status === "READY" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => act(order.id, () => setOrderStatusAction(order.id, "PENDING"))}
                  >
                    Voltar
                  </Button>
                )}
                <Button variant="secondary" disabled={busy} onClick={() => reprint(order.id)} aria-label="Reimprimir">
                  <Printer size={18} />
                </Button>
                {isOpen(order) && (
                  <Button
                    variant="ghost"
                    className="ml-auto text-red-600"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Cancelar o pedido #${order.number} de ${order.customerName}? O estoque será devolvido.`,
                        )
                      ) {
                        act(order.id, () => cancelOrderAction(order.id));
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
