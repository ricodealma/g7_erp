"use client";

import { BookUser, Minus, Plus, Star, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { priceCart } from "@/lib/combos";
import { customerKey } from "@/lib/customer";
import { formatBRL } from "@/lib/money";
import type { ReceiptData } from "@/lib/receipt";
import type { CounterProduct, CounterSnapshot } from "@/server/counter/queries";

import { createOrderAction } from "../actions";
import { PixQr } from "./pix-qr";
import { Button, inputClass } from "@/components/ui";

type Cart = Record<string, number>;
type PaymentMethod = "PIX" | "CASH" | "PAY_LATER";

function parseCents(value: string): number | undefined {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  if (!normalized) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : undefined;
}

export function isLowStock(product: CounterProduct) {
  return product.countable && (product.stockQuantity ?? 0) <= (product.lowStockThreshold ?? 0);
}

function ProductTile({ product, inCart, onAdd }: { product: CounterProduct; inCart: number; onAdd: () => void }) {
  const remaining = product.countable ? (product.stockQuantity ?? 0) - inCart : Infinity;
  const unavailable = product.soldOut || remaining <= 0;
  const low = isLowStock(product);

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={unavailable}
      className={`relative flex min-h-24 touch-manipulation flex-col justify-between rounded-2xl border-2 p-3 text-left transition active:scale-[0.97] disabled:opacity-40 ${
        inCart > 0
          ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <span className="font-semibold leading-tight">{product.name}</span>
      <span className="flex items-end justify-between gap-2 text-sm">
        <span className="font-medium">{formatBRL(product.priceCents)}</span>
        {product.soldOut ? (
          <span className="rounded-md bg-zinc-800 px-1.5 text-xs text-white">Esgotado</span>
        ) : product.countable ? (
          <span
            className={`rounded-md px-1.5 text-xs ${low ? "bg-red-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {Math.max(remaining, 0)} un
          </span>
        ) : null}
      </span>
      {inCart > 0 && (
        <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-amber-500 text-sm font-bold text-zinc-950">
          {inCart}
        </span>
      )}
    </button>
  );
}

export function NewOrder({
  snapshot,
  online,
  onCreated,
}: {
  snapshot: CounterSnapshot;
  online: boolean;
  onCreated: (order: { number: number; receipt: ReceiptData; accountBalanceCents: number | null }) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [notes, setNotes] = useState("");
  const [isReservation, setIsReservation] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  const products = useMemo(() => snapshot.products.filter((product) => product.inMenu), [snapshot.products]);
  const snacks = products.filter((product) => product.category === "SNACK");
  const drinks = products.filter((product) => product.category === "DRINK");
  const productMap = useMemo(
    () => new Map(snapshot.products.map((product) => [product.id, product])),
    [snapshot.products],
  );

  const lines = Object.entries(cart)
    .filter(([id, quantity]) => quantity > 0 && productMap.has(id))
    .map(([productId, quantity]) => ({ productId, quantity }));

  const combos = useMemo(
    () => snapshot.combos.map((combo) => ({ ...combo, optionIds: new Set(combo.optionIds) })),
    [snapshot.combos],
  );
  // Mesma precificação do servidor, para pré-visualizar combos e total.
  const priced = priceCart(lines, productMap, combos);

  const comboItems = priced.items.flatMap((item) => (item.kind === "COMBO" ? [item] : []));
  const received = parseCents(cashReceived);
  const change = received !== undefined ? received - priced.totalCents : undefined;
  const canSubmit = online && !pending && customerName.trim().length > 0 && lines.length > 0;

  // Conta de fiado: o nome é único, então "Depois" com o mesmo nome soma na conta existente.
  const nameKey = customerKey(customerName);
  const account = nameKey ? snapshot.accounts.find((candidate) => candidate.key === nameKey) : undefined;
  const suggestions =
    nameKey && !account ? snapshot.accounts.filter((candidate) => candidate.key.includes(nameKey)).slice(0, 4) : [];

  function add(productId: string, delta: number) {
    setError(null);
    setCart((current) => {
      const next = { ...current, [productId]: Math.max(0, (current[productId] ?? 0) + delta) };
      if (next[productId] === 0) delete next[productId];
      return next;
    });
  }

  function reset() {
    setCustomerName("");
    setCart({});
    setNotes("");
    setIsReservation(false);
    setCashReceived("");
    nameRef.current?.focus();
  }

  function submit(paymentMethod: PaymentMethod) {
    setError(null);
    startTransition(async () => {
      const result = await createOrderAction({
        customerName,
        isReservation,
        notes: notes.trim() || undefined,
        paymentMethod,
        amountReceivedCents: paymentMethod === "CASH" ? received : undefined,
        lines,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
      reset();
    });
  }

  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_400px]">
      <section className="flex flex-col gap-5" aria-label="Cardápio">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">Lanches do dia</h2>
          {snacks.length === 0 ? (
            <p className="text-sm opacity-60">Nenhum lanche no cardápio. Use “Cardápio” para incluir.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {snacks.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  inCart={cart[product.id] ?? 0}
                  onAdd={() => add(product.id, 1)}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">Bebidas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {drinks.map((product) => (
              <ProductTile
                key={product.id}
                product={product}
                inCart={cart[product.id] ?? 0}
                onAdd={() => add(product.id, 1)}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="Pedido"
        className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          ref={nameRef}
          className={`${inputClass} text-lg font-semibold`}
          placeholder="Nome do cliente"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="done"
          aria-label="Nome do cliente"
        />

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Contas de fiado">
            {suggestions.map((candidate) => (
              <Button
                key={candidate.id}
                variant="ghost"
                className="!min-h-9 !px-3 text-sm"
                onClick={() => setCustomerName(candidate.name)}
              >
                <BookUser size={16} /> {candidate.name} · {formatBRL(candidate.balanceCents)}
              </Button>
            ))}
          </div>
        )}
        {account && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
            <span className="font-semibold">{account.name}</span> já deve {formatBRL(account.balanceCents)}. “Depois”
            soma este pedido na mesma conta
            {priced.totalCents > 0 && <> (total {formatBRL(account.balanceCents + priced.totalCents)})</>}.
          </p>
        )}

        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">Toque nos produtos para adicionar.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {lines.map(({ productId, quantity }) => {
              const product = productMap.get(productId)!;
              return (
                <li key={productId} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 truncate">{product.name}</span>
                  <Button
                    variant="ghost"
                    className="!min-h-10 !px-2.5"
                    onClick={() => add(productId, -1)}
                    aria-label={`Remover ${product.name}`}
                  >
                    {quantity === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                  </Button>
                  <span className="w-6 text-center font-semibold tabular-nums">{quantity}</span>
                  <Button
                    variant="ghost"
                    className="!min-h-10 !px-2.5"
                    onClick={() => add(productId, 1)}
                    aria-label={`Adicionar ${product.name}`}
                  >
                    <Plus size={18} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {comboItems.length > 0 && (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
            {comboItems.map((item) => (
              <p key={`${item.comboId}|${item.components.map((component) => component.productId).join("|")}`}>
                {item.quantity}× {item.description}:{" "}
                {item.components.map((component) => component.description).join(" + ")}
              </p>
            ))}
            {priced.savingsCents > 0 && <p className="font-medium">Economia de {formatBRL(priced.savingsCents)}</p>}
          </div>
        )}

        <input
          className={inputClass}
          placeholder="Observação (ex: sem maionese)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={280}
          aria-label="Observação"
        />

        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-amber-500"
            checked={isReservation}
            onChange={(event) => setIsReservation(event.target.checked)}
          />
          <Star size={16} /> Reserva / antecipado
        </label>

        <div className="flex items-baseline justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-sm opacity-70">Total</span>
          <span className="text-3xl font-bold tabular-nums">{formatBRL(priced.totalCents)}</span>
        </div>

        {priced.totalCents > 0 && (
          <PixQr
            pixKey={snapshot.settings.pixKey}
            merchantName={snapshot.settings.pixMerchant}
            merchantCity={snapshot.settings.pixCity}
            amountCents={priced.totalCents}
          />
        )}

        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Dinheiro recebido (opcional)"
            value={cashReceived}
            onChange={(event) => setCashReceived(event.target.value)}
            aria-label="Dinheiro recebido"
          />
          {change !== undefined && (
            <span className={`shrink-0 text-sm font-semibold ${change < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {change < 0 ? `Faltam ${formatBRL(-change)}` : `Troco ${formatBRL(change)}`}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="success" className="min-h-14 text-base" disabled={!canSubmit} onClick={() => submit("PIX")}>
            Pix
          </Button>
          <Button
            variant="primary"
            className="min-h-14 text-base"
            disabled={!canSubmit || (change !== undefined && change < 0)}
            onClick={() => submit("CASH")}
          >
            Dinheiro
          </Button>
          <Button className="min-h-14 text-base" disabled={!canSubmit} onClick={() => submit("PAY_LATER")}>
            Depois
          </Button>
        </div>
        <p className="text-center text-xs opacity-60">
          {pending ? "Registrando pedido…" : "O botão de pagamento finaliza e imprime o pedido."}
        </p>
      </section>
    </div>
  );
}
