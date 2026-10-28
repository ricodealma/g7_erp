import { connection } from "next/server";
import { Suspense } from "react";

import { listPendingAccounts } from "@/server/admin/finance";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Loading, PageTitle } from "../_components/shared";
import { PendingPayments } from "./pending-payments";

async function Content() {
  await connection();
  await requireAdmin();
  return <PendingPayments accounts={await listPendingAccounts(db)} />;
}

export default function PayLaterPage() {
  return (
    <>
      <PageTitle
        title="Fiado"
        description="Contas de quem pegou para pagar depois, somadas por pessoa. Ao quitar, o valor entra no caixa do evento aberto."
      />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}
