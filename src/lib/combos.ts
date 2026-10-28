import type { Cents } from "./money";

export type CatalogProduct = {
  id: string;
  name: string;
  category: "SNACK" | "DRINK";
  priceCents: Cents;
};

export type CatalogCombo = {
  id: string;
  name: string;
  /** Produtos (lanches e bebidas) permitidos no combo. */
  optionIds: ReadonlySet<string>;
};

export type CartLine = { productId: string; quantity: number };

export type PricedProductItem = {
  kind: "PRODUCT";
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
};

export type PricedComboItem = {
  kind: "COMBO";
  comboId: string;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  components: { productId: string; description: string }[];
};

export type PricedItem = PricedProductItem | PricedComboItem;

export type PricedCart = {
  items: PricedItem[];
  totalCents: Cents;
  /** Economia obtida com combos em relação aos preços avulsos. */
  savingsCents: Cents;
};

/** Preço do combo: soma do lanche e da bebida sem os centavos (12,50 -> 12,00). */
export function comboPriceCents(snack: CatalogProduct, drink: CatalogProduct): Cents {
  return Math.floor((snack.priceCents + drink.priceCents) / 100) * 100;
}

/**
 * Combos Inteligentes (RF-06): agrupa automaticamente 1 lanche + 1 bebida do carrinho
 * permitidos no combo, escolhendo o par que gera maior economia. Itens que não formam
 * combo são cobrados avulsos; pares sem centavos (sem desconto) ficam avulsos.
 */
export function priceCart(
  lines: readonly CartLine[],
  products: ReadonlyMap<string, CatalogProduct>,
  combos: readonly CatalogCombo[],
): PricedCart {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Quantidade inválida para o produto ${line.productId}`);
    }
    if (!products.has(line.productId)) throw new Error(`Produto indisponível: ${line.productId}`);
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }

  const expand = (category: CatalogProduct["category"]) =>
    [...quantities]
      .map(([id, quantity]) => ({ product: products.get(id)!, quantity }))
      .filter(({ product }) => product.category === category)
      .flatMap(({ product, quantity }) => Array<CatalogProduct>(quantity).fill(product))
      .sort((a, b) => b.priceCents - a.priceCents || a.name.localeCompare(b.name));

  const snacks = expand("SNACK");
  const drinks = expand("DRINK");
  const looseSnacks: CatalogProduct[] = [];
  const comboKeys = new Map<string, PricedComboItem>();
  let savingsCents = 0;

  for (const snack of snacks) {
    let best: { drinkIndex: number; combo: CatalogCombo; savings: number } | undefined;
    drinks.forEach((drink, drinkIndex) => {
      for (const combo of combos) {
        if (!combo.optionIds.has(snack.id) || !combo.optionIds.has(drink.id)) continue;
        const savings = snack.priceCents + drink.priceCents - comboPriceCents(snack, drink);
        if (savings <= 0) continue;
        if (!best || savings > best.savings) best = { drinkIndex, combo, savings };
      }
    });

    if (!best) {
      looseSnacks.push(snack);
      continue;
    }

    const [drink] = drinks.splice(best.drinkIndex, 1);
    savingsCents += best.savings;
    const key = `${best.combo.id}|${snack.id}|${drink.id}`;
    const existing = comboKeys.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      comboKeys.set(key, {
        kind: "COMBO",
        comboId: best.combo.id,
        description: best.combo.name,
        quantity: 1,
        unitPriceCents: comboPriceCents(snack, drink),
        components: [
          { productId: snack.id, description: snack.name },
          { productId: drink.id, description: drink.name },
        ],
      });
    }
  }

  const loose = new Map<string, PricedProductItem>();
  for (const product of [...looseSnacks, ...drinks]) {
    const existing = loose.get(product.id);
    if (existing) existing.quantity += 1;
    else
      loose.set(product.id, {
        kind: "PRODUCT",
        productId: product.id,
        description: product.name,
        quantity: 1,
        unitPriceCents: product.priceCents,
      });
  }

  const items: PricedItem[] = [...comboKeys.values(), ...loose.values()];
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  return { items, totalCents, savingsCents };
}
