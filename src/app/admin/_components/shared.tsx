import type { ReactNode } from "react";

const TIME_ZONE = "America/Sao_Paulo";

/** "2026-11-01" -> "01/11/2026" (data de calendário, sem fuso). */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-sm opacity-70">{description}</p>}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {title && <h2 className="font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "";
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export function Loading() {
  return <p className="p-6 text-sm opacity-60">Carregando…</p>;
}

export const tableClass =
  "w-full text-sm [&_td]:border-t [&_td]:border-zinc-200 [&_td]:py-2 [&_td]:pr-3 dark:[&_td]:border-zinc-800 [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:opacity-60";
