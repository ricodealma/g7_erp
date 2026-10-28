import { connection } from "next/server";
import { Suspense } from "react";

import { listProducts } from "@/server/admin/catalog";
import { requireAdmin } from "@/server/auth";
import { db } from "@/server/db";

import { Loading, PageTitle } from "../_components/shared";
import { ProductsManager } from "./products-manager";

async function Content() {
  await connection();
  await requireAdmin();
  return <ProductsManager products={await listProducts(db)} />;
}

export default function ProductsPage() {
  return (
    <>
      <PageTitle
        title="Produtos"
        description="Lanches e bebidas, preços, tipo de controle de estoque e limite crítico."
      />
      <Suspense fallback={<Loading />}>
        <Content />
      </Suspense>
    </>
  );
}
