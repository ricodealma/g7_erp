import { describe, expect, it } from "vitest";

import { priceCart, type CatalogCombo, type CatalogProduct } from "@/lib/combos";

const products = new Map<string, CatalogProduct>(
  [
    { id: "salgado", name: "Salgado", category: "SNACK", priceCents: 700 },
    { id: "pizza", name: "Pizza", category: "SNACK", priceCents: 750 },
    { id: "pitchula", name: "Pitchulinha", category: "DRINK", priceCents: 300 },
    { id: "refri", name: "Refri Lata", category: "DRINK", priceCents: 500 },
    { id: "suco", name: "Suco", category: "DRINK", priceCents: 450 },
    { id: "agua", name: "Água", category: "DRINK", priceCents: 400 },
  ].map((product) => [product.id, product as CatalogProduct]),
);

const combo: CatalogCombo = {
  id: "combo",
  name: "Combo",
  optionIds: new Set(["salgado", "pizza", "pitchula", "refri", "suco"]),
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

  it("combo tira só os centavos da soma (7,50 + 5,00 = 12,00)", () => {
    const result = priceCart(
      [
        { productId: "pizza", quantity: 1 },
        { productId: "refri", quantity: 1 },
      ],
      products,
      [combo],
    );
    expect(result.totalCents).toBe(1200);
    expect(result.savingsCents).toBe(50);
    expect(result.items).toEqual([
      {
        kind: "COMBO",
        comboId: "combo",
        description: "Combo",
        quantity: 1,
        unitPriceCents: 1200,
        components: [
          { productId: "pizza", description: "Pizza" },
          { productId: "refri", description: "Refri Lata" },
        ],
      },
    ]);
  });

  it("par sem centavos fica avulso (7,00 + 3,00 = 10,00)", () => {
    const result = priceCart(
      [
        { productId: "salgado", quantity: 1 },
        { productId: "pitchula", quantity: 1 },
      ],
      products,
      [combo],
    );
    expect(result.totalCents).toBe(1000);
    expect(result.items.every((item) => item.kind === "PRODUCT")).toBe(true);
  });

  it("escolhe a bebida que gera centavos para tirar e cobra o restante avulso", () => {
    const result = priceCart(
      [
        { productId: "salgado", quantity: 1 },
        { productId: "refri", quantity: 1 },
        { productId: "suco", quantity: 1 },
      ],
      products,
      [combo],
    );
    // Salgado 7,00 + Suco 4,50 = 11,50 -> combo 11,00; Refri avulso 5,00.
    expect(result.totalCents).toBe(1600);
    expect(result.savingsCents).toBe(50);
    const comboItem = result.items.find((item) => item.kind === "COMBO");
    expect(comboItem?.kind === "COMBO" && comboItem.components.map((c) => c.productId)).toEqual(["salgado", "suco"]);
  });

  it("agrupa combos idênticos em quantidade", () => {
    const result = priceCart(
      [
        { productId: "pizza", quantity: 3 },
        { productId: "refri", quantity: 3 },
      ],
      products,
      [combo],
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ kind: "COMBO", quantity: 3, unitPriceCents: 1200 });
    expect(result.totalCents).toBe(3600);
  });

  it("ignora bebida não permitida no combo", () => {
    const result = priceCart(
      [
        { productId: "pizza", quantity: 1 },
        { productId: "agua", quantity: 1 },
      ],
      products,
      [combo],
    );
    expect(result.totalCents).toBe(1150);
    expect(result.items.every((item) => item.kind === "PRODUCT")).toBe(true);
  });

  it("rejeita produto desconhecido e quantidade inválida", () => {
    expect(() => priceCart([{ productId: "x", quantity: 1 }], products, [])).toThrow();
    expect(() => priceCart([{ productId: "agua", quantity: 0 }], products, [])).toThrow();
  });
});
