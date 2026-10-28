import { describe, expect, it } from "vitest";

import { can } from "@/server/auth-policy";

describe("permissões por perfil (RF-15)", () => {
  it("operador opera o balcão", () => {
    for (const permission of [
      "order.create",
      "order.status",
      "order.cancel",
      "order.reprint",
      "stock.restock",
      "menu.soldOut",
    ] as const) {
      expect(can("OPERATOR", permission)).toBe(true);
    }
  });

  it("operador não abre/encerra evento nem edita o cardápio", () => {
    expect(can("OPERATOR", "event.open")).toBe(false);
    expect(can("OPERATOR", "event.close")).toBe(false);
    expect(can("OPERATOR", "menu.edit")).toBe(false);
  });

  it("administrador pode tudo", () => {
    for (const permission of ["order.create", "menu.edit", "event.open", "event.close"] as const) {
      expect(can("ADMIN", permission)).toBe(true);
    }
  });
});
