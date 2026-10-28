"use client";

import { useState, useTransition } from "react";

import { formatBRL } from "@/lib/money";
import { connectPrinter } from "@/lib/printer/bluetooth";
import { printReceipt, printWithSystemDialog } from "@/lib/printer/print";
import { buildReceipt, receiptToText, type ReceiptData } from "@/lib/receipt";
import type { CounterProduct } from "@/server/counter/queries";

import { createQuickSnackAction, restockAction, updateMenuItemAction } from "../actions";
import { usePrinter } from "./hooks";
import { isLowStock } from "./new-order";
import { Button, Dialog, Field, inputClass } from "./ui";

type Result = { ok: true } | { ok: false; error: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<Result>, onSuccess?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  return { pending, error, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  ) : null;
}

/** RF-05 / RF-09a: lanches do dia, esgotados e cadastro rápido. */
export function MenuDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: CounterProduct[] }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [countable, setCountable] = useState(false);
  const [quantity, setQuantity] = useState("");
  const snacks = products.filter((product) => product.category === "SNACK");

  function createSnack() {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    run(
      () =>
        createQuickSnackAction({
          name,
          priceCents: Number.isFinite(priceCents) ? priceCents : -1,
          countable,
          stockQuantity: countable ? Number(quantity || 0) : undefined,
        }),
      () => {
        setName("");
        setPrice("");
        setQuantity("");
        setCountable(false);
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cardápio do dia" wide>
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {snacks.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-3 py-2">
              <label className="flex min-h-11 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-amber-500"
                  checked={product.inMenu}
                  disabled={pending}
                  onChange={(event) => run(() => updateMenuItemAction({ productId: product.id, inMenu: event.target.checked }))}
                />
                <span>
                  <span className="font-medium">{product.name}</span>
                  <span className="block text-xs opacity-60">
                    {formatBRL(product.priceCents)} · {product.countable ? `${product.stockQuantity} un` : "sem contagem"}
                  </span>
                </span>
              </label>
              {product.inMenu && (
                <Button
                  variant={product.soldOut ? "danger" : "secondary"}
                  disabled={pending}
                  onClick={() => run(() => updateMenuItemAction({ productId: product.id, soldOut: !product.soldOut }))}
                >
                  {product.soldOut ? "Esgotado" : "Marcar esgotado"}
                </Button>
              )}
            </li>
          ))}
        </ul>

        <fieldset className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-semibold">Novo lanche</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Nome">
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </Field>
            <Field label="Preço (R$)">
              <input className={inputClass} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-amber-500" checked={countable} onChange={(event) => setCountable(event.target.checked)} />
            Controlar quantidade (rendimento conhecido)
          </label>
          {countable && (
            <Field label="Quantidade disponível">
              <input className={inputClass} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
          <Button variant="primary" disabled={pending || !name.trim() || !price} onClick={createSnack}>
            Adicionar ao cardápio
          </Button>
        </fieldset>
        <ErrorText error={error} />
      </div>
    </Dialog>
  );
}

/** RF-10 / RF-11: saldos, alertas e entrada rápida. */
export function StockDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: CounterProduct[] }) {
  const { pending, error, run } = useAction();
  const [custom, setCustom] = useState<Record<string, string>>({});
  const countable = products.filter((product) => product.countable);

  return (
    <Dialog open={open} onClose={onClose} title="Estoque" wide>
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {countable.map((product) => (
          <li key={product.id} className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{product.name}</span>
              <span className={`rounded-md px-2 text-sm font-semibold tabular-nums ${isLowStock(product) ? "bg-red-600 text-white" : ""}`}>
                {product.stockQuantity} un
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 6, 12, 24].map((amount) => (
                <Button key={amount} disabled={pending} onClick={() => run(() => restockAction(product.id, amount))}>
                  +{amount}
                </Button>
              ))}
              <input
                className={`${inputClass} !w-24`}
                inputMode="numeric"
                placeholder="Qtd"
                value={custom[product.id] ?? ""}
                onChange={(event) => setCustom({ ...custom, [product.id]: event.target.value.replace(/\D/g, "") })}
                aria-label={`Quantidade para ${product.name}`}
              />
              <Button
                variant="primary"
                disabled={pending || !custom[product.id]}
                onClick={() =>
                  run(
                    () => restockAction(product.id, Number(custom[product.id])),
                    () => setCustom({ ...custom, [product.id]: "" }),
                  )
                }
              >
                Adicionar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
    </Dialog>
  );
}

/** Pré-visualização do cupom quando a impressora Bluetooth não está conectada (RF-02). */
export function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptData | null; onClose: () => void }) {
  const printer = usePrinter();
  const [error, setError] = useState<string | null>(null);

  async function connectAndPrint() {
    if (!receipt) return;
    setError(null);
    await connectPrinter();
    try {
      if ((await printReceipt(receipt)) === "bluetooth") onClose();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <Dialog open={receipt !== null} onClose={onClose} title={receipt ? `Pedido #${String(receipt.number).padStart(3, "0")}` : "Cupom"}>
      {receipt && (
        <div className="flex flex-col gap-4">
          <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-3 font-mono text-[11px] leading-snug text-zinc-900">
            {receiptToText(buildReceipt(receipt))}
          </pre>
          <p className="text-sm opacity-70">Impressora Bluetooth {printer.status === "unsupported" ? "não suportada neste navegador" : "desconectada"}.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {printer.status !== "unsupported" && (
              <Button variant="primary" onClick={connectAndPrint}>
                Conectar e imprimir
              </Button>
            )}
            <Button onClick={() => printWithSystemDialog(receipt)}>Imprimir pelo sistema</Button>
          </div>
          <ErrorText error={error ?? printer.error} />
        </div>
      )}
    </Dialog>
  );
}
