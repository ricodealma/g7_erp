import { describe, expect, it } from "vitest";

import { cleanCustomerName, customerKey } from "@/lib/customer";

describe("customerKey", () => {
  it("ignora maiúsculas, acentos e espaços extras", () => {
    expect(customerKey("  José  da  Conceição ")).toBe("jose da conceicao");
    expect(customerKey("RICARDO")).toBe(customerKey("ricardo"));
    expect(customerKey("Ricardo Silva")).not.toBe(customerKey("Ricardo"));
  });

  it("limpa o nome exibido sem mudar a grafia", () => {
    expect(cleanCustomerName("  Zé   Maria ")).toBe("Zé Maria");
  });
});
