import { connection } from "next/server";
import { Suspense } from "react";

import { can } from "@/server/auth-policy";
import { requireViewer } from "@/server/auth";
import { getCounterSnapshot } from "@/server/counter/queries";
import { db } from "@/server/db";

import { CounterApp } from "./_components/counter-app";

async function Counter() {
  // Sessão e dados são por requisição; o cliente do Supabase usa Date.now() ao iniciar.
  await connection();
  const viewer = await requireViewer();
  const snapshot = await getCounterSnapshot(db);
  return (
    <CounterApp
      snapshot={snapshot}
      viewer={{
        name: viewer.name,
        role: viewer.role,
        canEditMenu: can(viewer.role, "menu.edit"),
        canManageEvent: can(viewer.role, "event.open"),
      }}
    />
  );
}

export default function CounterPage() {
  return (
    <Suspense fallback={<p className="m-auto p-6 text-sm opacity-60">Carregando balcão…</p>}>
      <Counter />
    </Suspense>
  );
}
