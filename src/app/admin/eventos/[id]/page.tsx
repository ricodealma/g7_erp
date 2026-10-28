import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { formatBRL } from "@/lib/money";
import { getEventReport } from "@/server/admin/finance";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Card, formatDate, formatDateTime, Loading, PageTitle, Stat, tableClass } from "../../_components/shared";
import { CloseEventForm } from "./close-event-form";

async function EventReport({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  const report = id.success ? await getEventReport(db, id.data) : null;
  if (!report) notFound();

  const { event, byMethod, settlements } = report;
  const closed = event.status === "CLOSED";
  const difference = event.countedCashCents === null ? null : event.countedCashCents - report.expectedCashCents;

  return (
    <>
      <PageTitle
        title={event.name}
        description={`${formatDate(event.date)} · ${
          closed
            ? `encerrado em ${formatDateTime(event.closedAt!)}${event.closedByName ? ` por ${event.closedByName}` : ""}`
            : "aberto"
        }`}
      />

      <Card title="Vendas">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total vendido" value={formatBRL(report.totalCents)} />
          <Stat label="Pedidos" value={String(report.orderCount)} />
          <Stat label="Cancelados" value={String(report.canceledCount)} />
          <Stat
            label="Em aberto"
            value={String(report.openOrderCount)}
            tone={report.openOrderCount ? "danger" : undefined}
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Por forma de pagamento">
          <table className={tableClass}>
            <tbody>
              <tr>
                <td>Pix</td>
                <td className="text-right tabular-nums">{formatBRL(byMethod.PIX)}</td>
              </tr>
              <tr>
                <td>Dinheiro</td>
                <td className="text-right tabular-nums">{formatBRL(byMethod.CASH)}</td>
              </tr>
              <tr>
                <td>Fiado já quitado</td>
                <td className="text-right tabular-nums">{formatBRL(byMethod.PAY_LATER_PAID)}</td>
              </tr>
              <tr>
                <td>Fiado em aberto</td>
                <td className={`text-right tabular-nums ${byMethod.PAY_LATER_PENDING ? "text-red-600" : ""}`}>
                  {formatBRL(byMethod.PAY_LATER_PENDING)}
                </td>
              </tr>
            </tbody>
          </table>
          {settlements.count > 0 && (
            <p className="text-sm opacity-70">
              Fiado recebido durante este evento: {formatBRL(settlements.pixCents)} em Pix e{" "}
              {formatBRL(settlements.cashCents)} em dinheiro ({settlements.count} pedido(s)).
            </p>
          )}
        </Card>

        <Card title="Fechamento de caixa">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Dinheiro esperado" value={formatBRL(report.expectedCashCents)} />
            {event.countedCashCents !== null && <Stat label="Contado" value={formatBRL(event.countedCashCents)} />}
            {difference !== null && (
              <Stat
                label="Diferença"
                value={formatBRL(difference)}
                tone={difference < 0 ? "danger" : difference > 0 ? "success" : undefined}
              />
            )}
          </div>
          <p className="text-xs opacity-60">Vendas em dinheiro + fiado quitado em dinheiro durante o evento.</p>
          {event.closingNotes && <p className="text-sm">Observações: {event.closingNotes}</p>}
          {!closed && (
            <CloseEventForm
              eventId={event.id}
              eventName={event.name}
              expectedCashCents={report.expectedCashCents}
              openOrderCount={report.openOrderCount}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Vendas por item">
          {report.items.length === 0 ? (
            <p className="text-sm opacity-70">Nenhuma venda.</p>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="!text-right">Qtd</th>
                  <th className="!text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item) => (
                  <tr key={item.key}>
                    <td>
                      {item.description}
                      {item.combo && <span className="ml-1 text-xs opacity-60">(combo)</span>}
                    </td>
                    <td className="text-right tabular-nums">{item.quantity}</td>
                    <td className="text-right tabular-nums">{formatBRL(item.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Unidades por produto">
          <p className="-mt-2 text-xs opacity-60">Inclui os itens servidos dentro de combos.</p>
          {report.units.length === 0 ? (
            <p className="text-sm opacity-70">Nenhuma venda.</p>
          ) : (
            <table className={tableClass}>
              <tbody>
                {report.units.map((unit) => (
                  <tr key={unit.productId}>
                    <td>{unit.name}</td>
                    <td className="text-right tabular-nums">{unit.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

export default function EventPage({ params }: PageProps<"/admin/eventos/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <EventReport params={params} />
    </Suspense>
  );
}
