"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button, Dialog, Field, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import { formatBRL, parseCents } from "@/lib/money";
import type { AdminCombo, AdminProduct } from "@/server/admin/catalog";

import { saveComboAction } from "../actions";
import { Card } from "../_components/shared";

function ComboForm({
  combo,
  products,
  onDone,
}: {
  combo: AdminCombo | null;
  products: AdminProduct[];
  onDone: () => void;
}) {
  const { pending, error, setError, run } = useAction();
  const [name, setName] = useState(combo?.name ?? "");
  const [price, setPrice] = useState(combo ? formatBRL(combo.priceCents) : "");
  const [optionIds, setOptionIds] = useState<string[]>(combo?.optionIds ?? []);
  const [active, setActive] = useState(combo?.active ?? true);

  function toggle(id: string, checked: boolean) {
    setOptionIds(checked ? [...optionIds, id] : optionIds.filter((optionId) => optionId !== id));
  }

  function submit() {
    const priceCents = parseCents(price);
    if (priceCents === null) return setError("Preço inválido.");
    run(() => saveComboAction({ id: combo?.id, name, priceCents, optionIds, active }), onDone);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Field label="Nome">
          <input className={inputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Preço fixo (R$)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
      </div>
      {(["SNACK", "DRINK"] as const).map((category) => (
        <fieldset key={category} className="flex flex-col">
          <legend className="mb-1 text-sm font-medium">
            {category === "SNACK" ? "Lanches permitidos" : "Bebidas permitidas"}
          </legend>
          {products
            .filter((product) => product.category === category && (product.active || optionIds.includes(product.id)))
            .map((product) => (
              <label key={product.id} className="flex min-h-10 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-amber-500"
                  checked={optionIds.includes(product.id)}
                  onChange={(event) => toggle(product.id, event.target.checked)}
                />
                <span className="flex-1">{product.name}</span>
                <span className="opacity-60">{formatBRL(product.priceCents)}</span>
              </label>
            ))}
        </fieldset>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 accent-amber-500"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Ativo
      </label>
      <ErrorText error={error} />
      <Button variant="primary" disabled={pending || !name.trim() || !price} onClick={submit}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}

export function CombosManager({ combos, products }: { combos: AdminCombo[]; products: AdminProduct[] }) {
  const [editing, setEditing] = useState<AdminCombo | "new" | null>(null);
  const names = new Map(products.map((product) => [product.id, product.name]));

  return (
    <Card>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> Novo combo
        </Button>
      </div>
      {combos.length === 0 && <p className="text-sm opacity-70">Nenhum combo cadastrado.</p>}
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {combos.map((combo) => (
          <li key={combo.id} className={`flex items-center gap-3 py-3 ${combo.active ? "" : "opacity-50"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {combo.name} <span className="tabular-nums">{formatBRL(combo.priceCents)}</span>
                {!combo.active && <span className="ml-2 text-xs">(inativo)</span>}
              </p>
              <p className="text-xs opacity-60">{combo.optionIds.map((id) => names.get(id)).join(", ")}</p>
            </div>
            <Button variant="ghost" className="!min-h-9 !px-3 text-sm" onClick={() => setEditing(combo)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo combo" : "Editar combo"}
      >
        {editing !== null && (
          <ComboForm
            key={editing === "new" ? "new" : editing.id}
            combo={editing === "new" ? null : editing}
            products={products}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}
