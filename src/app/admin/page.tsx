import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { formatBRL } from "@/lib/money";
import { listEvents, pendingPaymentsTotal } from "@/server/admin/finance";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Card, formatDate, Loading, PageTitle, Stat, tableClass } from "./_components/shared";

async function Overview() {
  await connection();
  await requireAdmin();
  const [events, pending] = await Promise.all([listEvents(db), pendingPaymentsTotal(db)]);
  const open = events.find((event) => event.status === "OPEN");

  return (
    <>
      <PageTitle title="Financeiro" description="Vendas e fechamento de caixa por evento." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Evento aberto">
          {open ? (
            <>
              <p>
                <span className="font-medium">{open.name}</span>{" "}
                <span className="text-sm opacity-60">{formatDate(open.date)}</span>
              </p>
              <Stat label={`${open.orderCount} pedido(s)`} value={formatBRL(open.totalCents)} />
              <Link
                href={`/admin/eventos/${open.id}`}
                className="text-sm font-medium text-amber-700 underline dark:text-amber-400"
              >
                Ver relatório e fechar caixa
              </Link>
            </>
          ) : (
            <p className="text-sm opacity-70">Nenhum evento aberto. Abra um evento pelo balcão.</p>
          )}
        </Card>
        <Card title="Fiado em aberto">
          <Stat
            label={`${pending.accounts} conta(s) · ${pending.count} pedido(s)`}
            value={formatBRL(pending.totalCents)}
            tone={pending.count ? "danger" : undefined}
          />
          <Link href="/admin/fiado" className="text-sm font-medium text-amber-700 underline dark:text-amber-400">
            Quitar pagamentos
          </Link>
        </Card>
      </div>

      <Card title="Eventos">
        {events.length === 0 ? (
          <p className="text-sm opacity-70">Nenhum evento registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th className="!text-right">Pedidos</th>
                  <th className="!text-right">Total</th>
                  <th className="!text-right">Diferença no caixa</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap">{formatDate(event.date)}</td>
                    <td>
                      <Link href={`/admin/eventos/${event.id}`} className="font-medium underline">
                        {event.name}
                      </Link>
                      {event.status === "OPEN" && (
                        <span className="ml-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs text-white">aberto</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{event.orderCount}</td>
                    <td className="text-right tabular-nums">{formatBRL(event.totalCents)}</td>
                    <td
                      className={`text-right tabular-nums ${
                        event.cashDifferenceCents
                          ? event.cashDifferenceCents < 0
                            ? "text-red-600"
                            : "text-emerald-600"
                          : ""
                      }`}
                    >
                      {event.cashDifferenceCents === null ? "—" : formatBRL(event.cashDifferenceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Overview />
    </Suspense>
  );
}
