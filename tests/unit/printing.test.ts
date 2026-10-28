import { describe, expect, it } from "vitest";

import { encodeReceipt } from "@/lib/escpos";
import { crc16, buildPixPayload } from "@/lib/pix";
import { buildReceipt, RECEIPT_COLUMNS, receiptToText, type ReceiptData } from "@/lib/receipt";
import { toPrinterText, wrap } from "@/lib/text";

describe("toPrinterText", () => {
  it("translitera acentos e cedilha para maiúsculas ASCII", () => {
    expect(toPrinterText("Pão com Pernil, água e açaí")).toBe("PAO COM PERNIL, AGUA E ACAI");
  });

  it("troca caracteres fora do ASCII imprimível", () => {
    expect(toPrinterText("café ☕")).toBe("CAFE ?");
  });
});

describe("wrap", () => {
  it("quebra por palavras sem ultrapassar a largura", () => {
    const lines = wrap("CLIENTE: MARIA APARECIDA DOS SANTOS OLIVEIRA", 20);
    expect(lines.every((line) => line.length <= 20)).toBe(true);
    expect(lines.join(" ")).toBe("CLIENTE: MARIA APARECIDA DOS SANTOS OLIVEIRA");
  });

  it("corta palavras maiores que a largura", () => {
    expect(wrap("ABCDEFGHIJ", 4)).toEqual(["ABCD", "EFGH", "IJ"]);
  });
});

describe("Pix", () => {
  it("calcula CRC16-CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("gera BR Code com valor, chave e CRC válido", () => {
    const payload = buildPixPayload({
      key: "jovens.cdc.7@gmail.com",
      merchantName: "Cantina G7",
      merchantCity: "São Paulo",
      amountCents: 1400,
    });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("0014br.gov.bcb.pix0122jovens.cdc.7@gmail.com");
    expect(payload).toContain("540514.00");
    expect(payload).toContain("6009SAO PAULO");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });
});

const receipt: ReceiptData = {
  header: "Cantina G7 - ERP",
  eventName: "Culto Domingo",
  number: 42,
  isReservation: false,
  customerName: "Marcos Silva",
  createdAt: new Date("2026-11-02T23:45:00Z"),
  items: [
    { quantity: 1, description: "Combo Lanche do Dia", totalCents: 1000, components: ["Pão com Pernil", "Refri Lata"] },
    { quantity: 1, description: "Água com gás", totalCents: 400, components: [] },
  ],
  notes: "Sem maionese",
  totalCents: 1400,
  paymentLabel: "PIX",
};

describe("buildReceipt", () => {
  it("respeita 32 colunas e usa horário de São Paulo", () => {
    const lines = buildReceipt(receipt);
    expect(lines.every((line) => line.text.length <= RECEIPT_COLUMNS)).toBe(true);

    const text = receiptToText(lines);
    expect(text).toContain("PEDIDO #042");
    expect(text).toContain("TIPO: BALCAO");
    expect(text).toContain("HORA: 20:45");
    expect(text).toContain("-> PAO COM PERNIL");
    expect(text).toContain(" 1   COMBO LANCHE DO    R$ 10,00\n     DIA\n");
    expect(text).toContain("*OBS: SEM MAIONESE*");
    expect(text).toMatch(/TOTAL:\s+R\$ 14,00/);
    expect(text).not.toMatch(/[^\x20-\x7E\n]/);
  });

  it("destaca reservas", () => {
    const text = receiptToText(buildReceipt({ ...receipt, isReservation: true }));
    expect(text).toContain("*** RESERVA ***");
    expect(text).toContain("TIPO: RESERVA");
  });
});

describe("encodeReceipt", () => {
  it("inicializa a impressora e envia apenas bytes ASCII no texto", () => {
    const bytes = encodeReceipt(buildReceipt(receipt));
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect(bytes.every((byte) => byte < 0x80)).toBe(true);
    expect([...bytes.slice(-3)]).toEqual([0x1b, 0x64, 4]);
  });
});
