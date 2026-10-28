import { connection } from "next/server";
import { Suspense } from "react";

import { getCounterSnapshot } from "@/server/counter/queries";
import { db } from "@/server/db";

import { CounterApp } from "./_components/counter-app";

async function Counter() {
  await connection();
  const snapshot = await getCounterSnapshot(db);
  return <CounterApp snapshot={snapshot} />;
}

export default function CounterPage() {
  return (
    <Suspense fallback={<p className="m-auto p-6 text-sm opacity-60">Carregando balcão…</p>}>
      <Counter />
    </Suspense>
  );
}
