import { connection } from "next/server";
import { Suspense } from "react";

import { getSettings } from "@/server/admin/catalog";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Loading, PageTitle } from "../_components/shared";
import { SettingsForm } from "./settings-form";

async function Content() {
  await connection();
  await requireAdmin();
  return <SettingsForm settings={await getSettings(db)} />;
}

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Configurações" description="Dados do Pix e cabeçalho do cupom impresso." />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}
