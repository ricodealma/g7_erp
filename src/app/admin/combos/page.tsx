import { connection } from "next/server";
import { Suspense } from "react";

import { listCombos, listProducts } from "@/server/admin/catalog";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Loading, PageTitle } from "../_components/shared";
import { CombosManager } from "./combos-manager";

async function Content() {
  await connection();
  await requireAdmin();
  const [combos, products] = await Promise.all([listCombos(db), listProducts(db)]);
  return <CombosManager combos={combos} products={products} />;
}

export default function CombosPage() {
  return (
    <>
      <PageTitle
        title="Combos"
        description="Preço fixo para 1 lanche + 1 bebida. O balcão aplica o combo automaticamente quando compensa."
      />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}
