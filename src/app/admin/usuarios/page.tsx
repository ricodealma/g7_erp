import { connection } from "next/server";
import { Suspense } from "react";

import { env } from "@/env";
import { listUsers } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Loading, PageTitle } from "../_components/shared";
import { UsersManager } from "./users-manager";

async function Content() {
  await connection();
  const viewer = await requireAdmin();
  return (
    <UsersManager
      users={await listUsers(db)}
      viewerId={viewer.id}
      authAdminAvailable={Boolean(env.SUPABASE_SECRET_KEY)}
    />
  );
}

export default function UsersPage() {
  return (
    <>
      <PageTitle title="Usuários" description="Administradores acessam este painel; operadores, somente o balcão." />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}
