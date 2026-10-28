"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button, Dialog, Field, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { formatBRL, parseCents } from "@/lib/money";
import type { AdminProduct } from "@/server/admin/catalog";

import { createProductAction, setStockCountAction, updateProductAction } from "../actions";
import { Card, tableClass } from "../_components/shared";

const CATEGORY_LABEL = { SNACK: "Lanche", DRINK: "Bebida" } as const;

const digits = (value: string) => value.replace(/\D/g, "");

function ProductForm({ product, onDone }: { product: AdminProduct | null; onDone: () => void }) {
  const { pending, error, setError, run } = useAction();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<"SNACK" | "DRINK">(product?.category ?? "DRINK");
  const [price, setPrice] = useState(product ? formatBRL(product.priceCents) : "");
  const [countable, setCountable] = useState(product?.countable ?? true);
  const [threshold, setThreshold] = useState(String(product?.lowStockThreshold ?? 3));
  const [initialStock, setInitialStock] = useState("0");
  const [active, setActive] = useState(product?.active ?? true);

  function submit() {
    const priceCents = parseCents(price);
    if (priceCents === null) return setError("Preço inválido.");
    const data = {
      name,
      category,
      priceCents,
      countable,
      lowStockThreshold: countable && threshold ? Number(threshold) : null,
      active,
    };
    run(
      () =>
        product
          ? updateProductAction({ id: product.id, product: data })
          : createProductAction({ product: data, initialStock: Number(initialStock || 0) }),
      onDone,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Nome">
          <input className={inputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Preço (R$)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Categoria">
        <select
          className={inputClass}
          value={category}
          onChange={(event) => setCategory(event.target.value as "SNACK" | "DRINK")}
        >
          <option value="DRINK">Bebida</option>
          <option value="SNACK">Lanche (entra no cardápio do dia)</option>
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={countable}
          onChange={(event) => setCountable(event.target.checked)}
        />
        Controlar quantidade em estoque
      </label>
      {product && product.countable !== countable && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {countable ? "O saldo começará em 0; ajuste pela contagem depois." : "O saldo atual será descartado."}
        </p>
      )}
      {countable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Alerta de estoque crítico (un)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={threshold}
              onChange={(event) => setThreshold(digits(event.target.value))}
            />
          </Field>
          {!product && (
            <Field label="Saldo inicial (un)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={initialStock}
                onChange={(event) => setInitialStock(digits(event.target.value))}
              />
            </Field>
          )}
        </div>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Ativo (aparece no balcão)
      </label>
      <ErrorText error={error} />
      <Button variant="primary" disabled={pending || !name.trim() || !price} onClick={submit}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}

function StockCount({ product }: { product: AdminProduct }) {
  const { pending, error, run } = useAction();
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          className={`${inputClass} !min-h-9 !w-20`}
          inputMode="numeric"
          placeholder={String(product.stockQuantity)}
          value={value}
          onChange={(event) => setValue(digits(event.target.value))}
          aria-label={`Contagem de ${product.name}`}
        />
        <Button
          className="!min-h-9 !px-3 text-sm"
          disabled={pending || value === ""}
          onClick={() =>
            run(
              () => setStockCountAction(product.id, Number(value)),
              () => setValue(""),
            )
          }
        >
          Ajustar
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function ProductsManager({ products }: { products: AdminProduct[] }) {
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm opacity-70">
          Toque no nome para editar. “Ajustar” define o saldo real após uma contagem e registra a diferença na
          auditoria.
        </p>
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> Novo
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Produto</th>
              <th className="!text-right">Preço</th>
              <th>Estoque</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const low =
                product.countable &&
                product.stockQuantity !== null &&
                product.stockQuantity <= (product.lowStockThreshold ?? 0);
              return (
                <tr key={product.id} className={product.active ? "" : "opacity-50"}>
                  <td>
                    <button type="button" className="min-h-11 text-left" onClick={() => setEditing(product)}>
                      <span className="font-medium underline decoration-dotted underline-offset-4">{product.name}</span>
                      <span className="block text-xs opacity-60">
                        {CATEGORY_LABEL[product.category]}
                        {!product.active && " · inativo"} · editar
                      </span>
                    </button>
                  </td>
                  <td className="text-right tabular-nums">{formatBRL(product.priceCents)}</td>
                  <td>
                    {product.countable ? (
                      <div className="flex flex-col gap-1">
                        <span className={`whitespace-nowrap ${low ? "font-semibold text-red-600" : ""}`}>
                          {product.stockQuantity} un{" "}
                          <span className="text-xs font-normal opacity-60">
                            (alerta ≤ {product.lowStockThreshold ?? 0})
                          </span>
                        </span>
                        <StockCount product={product} />
                      </div>
                    ) : (
                      <span className="text-xs opacity-60">sem contagem</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo produto" : "Editar produto"}
      >
        {editing !== null && (
          <ProductForm
            key={editing === "new" ? "new" : editing.id}
            product={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}
