import { describe, expect, it } from "vitest";

import { priceCart, type CatalogCombo, type CatalogProduct } from "@/lib/combos";

const products = new Map<string, CatalogProduct>(
  [
    { id: "salgado", name: "Salgado", category: "SNACK", priceCents: 700 },
    { id: "pizza", name: "Pizza", category: "SNACK", priceCents: 750 },
    { id: "pitchula", name: "Pitchulinha", category: "DRINK", priceCents: 300 },
    { id: "refri", name: "Refri Lata", category: "DRINK", priceCents: 500 },
    { id: "agua", name: "Água", category: "DRINK", priceCents: 400 },
  ].map((product) => [product.id, product as CatalogProduct]),
);

const combo: CatalogCombo = {
  id: "combo",
  name: "Combo",
  priceCents: 1000,
  optionIds: new Set(["salgado", "pizza", "pitchula", "refri"]),
};

describe("priceCart", () => {
  it("cobra avulso quando não há combo possível", () => {
    const result = priceCart([{ productId: "agua", quantity: 2 }], products, [combo]);
    expect(result.items).toEqual([
      { kind: "PRODUCT", productId: "agua", description: "Água", quantity: 2, unitPriceCents: 400 },
    ]);
    expect(result.totalCents).toBe(800);
    expect(result.savingsCents).toBe(0);
  });

  it("aplica o combo para arredondar (7 + 3 = 10)", () => {
    const result = priceCart(
      [
        { productId: "salgado", quantity: 1 },
        { productId: "pitchula", quantity: 1 },
      ],
      products,
      [combo],
    );
    expect(result.totalCents).toBe(1000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "COMBO", quantity: 1, unitPriceCents: 1000 });
  });

  it("prioriza a bebida que gera maior economia e cobra o restante avulso", () => {
    const result = priceCart(
      [
        { productId: "pizza", quantity: 1 },
        { productId: "pitchula", quantity: 1 },
        { productId: "refri", quantity: 1 },
      ],
      products,
      [combo],
    );
    // Pizza 7,50 + Refri 5,00 = 12,50 -> combo 10,00; Pitchulinha avulsa 3,00.
    expect(result.totalCents).toBe(1300);
    expect(result.savingsCents).toBe(250);
    const comboItem = result.items.find((item) => item.kind === "COMBO");
    expect(comboItem?.kind === "COMBO" && comboItem.components.map((c) => c.productId)).toEqual(["pizza", "refri"]);
  });

  it("agrupa combos idênticos em quantidade", () => {
    const result = priceCart(
      [
        { productId: "salgado", quantity: 3 },
        { productId: "refri", quantity: 3 },
      ],
      products,
      [combo],
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "COMBO", quantity: 3 });
    expect(result.totalCents).toBe(3000);
  });

  it("ignora bebida não permitida no combo", () => {
    const result = priceCart(
      [
        { productId: "salgado", quantity: 1 },
        { productId: "agua", quantity: 1 },
      ],
      products,
      [combo],
    );
    expect(result.totalCents).toBe(1100);
    expect(result.items.every((item) => item.kind === "PRODUCT")).toBe(true);
  });

  it("nunca aplica combo mais caro que a soma avulsa", () => {
    const expensive = { ...combo, priceCents: 2000 };
    const result = priceCart(
      [
        { productId: "salgado", quantity: 1 },
        { productId: "pitchula", quantity: 1 },
      ],
      products,
      [expensive],
    );
    expect(result.totalCents).toBe(1000);
    expect(result.items.every((item) => item.kind === "PRODUCT")).toBe(true);
  });

  it("rejeita produto desconhecido e quantidade inválida", () => {
    expect(() => priceCart([{ productId: "x", quantity: 1 }], products, [])).toThrow();
    expect(() => priceCart([{ productId: "agua", quantity: 0 }], products, [])).toThrow();
  });
});
