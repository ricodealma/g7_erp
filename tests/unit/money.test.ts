import { describe, expect, it } from "vitest";

import { formatBRL, parseCents } from "@/lib/money";

describe("parseCents", () => {
  it("aceita os formatos digitados no Brasil", () => {
    expect(parseCents("7,50")).toBe(750);
    expect(parseCents("R$ 1.234,56")).toBe(123456);
    expect(parseCents("10")).toBe(1000);
    expect(parseCents("10.5")).toBe(1050);
    expect(parseCents("0,1")).toBe(10);
  });

  it("recusa valores inválidos", () => {
    for (const input of ["", "abc", "-5", "1,234", "7,5,0"]) expect(parseCents(input)).toBeNull();
  });

  it("faz ida e volta com formatBRL", () => {
    expect(parseCents(formatBRL(123456))).toBe(123456);
  });
});
