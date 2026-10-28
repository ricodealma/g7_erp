import { formatBRL, type Cents } from "./money";
import { padEnd, padStart, toPrinterText, wrap } from "./text";

/** 58 mm = 384 pontos = 32 colunas na fonte padrão (12x24). */
export const RECEIPT_COLUMNS = 32;

export type ReceiptLine = {
  text: string;
  align?: "left" | "center";
  bold?: boolean;
  /** Altura dupla (mantém as 32 colunas). */
  tall?: boolean;
};

export type ReceiptData = {
  header: string;
  eventName: string;
  number: number;
  isReservation: boolean;
  customerName: string;
  createdAt: Date;
  items: {
    quantity: number;
    description: string;
    totalCents: Cents;
    components: string[];
  }[];
  notes: string | null;
  totalCents: Cents;
  paymentLabel: string;
};

const PAYMENT_LABELS = {
  PIX: "PIX",
  CASH: "DINHEIRO",
  PAY_LATER: "PAGAR DEPOIS (PENDENTE)",
} as const;

export function paymentLabel(method: keyof typeof PAYMENT_LABELS): string {
  return PAYMENT_LABELS[method];
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

/** "R$ 10,00" com espaço comum (o Intl usa espaço não separável). */
function money(cents: Cents): string {
  return toPrinterText(formatBRL(cents).replace(/\s/g, " "));
}

function twoColumns(left: string, right: string): string {
  return padEnd(left, RECEIPT_COLUMNS - right.length) + right;
}

/** Monta o cupom da comanda (layout do documento de requisitos), já transliterado. */
export function buildReceipt(data: ReceiptData): ReceiptLine[] {
  const t = toPrinterText;
  const double = "=".repeat(RECEIPT_COLUMNS);
  const single = "-".repeat(RECEIPT_COLUMNS);
  const lines: ReceiptLine[] = [
    { text: double },
    { text: t(data.header), align: "center", bold: true, tall: true },
    { text: double },
  ];

  if (data.isReservation) lines.push({ text: "*** RESERVA ***", align: "center", bold: true, tall: true });

  lines.push(
    ...wrap(t(`EVENTO: ${data.eventName}`), RECEIPT_COLUMNS).map((text) => ({ text })),
    {
      text: twoColumns(
        `PEDIDO #${String(data.number).padStart(3, "0")}`,
        `TIPO: ${data.isReservation ? "RESERVA" : "BALCAO"}`,
      ),
      bold: true,
    },
    ...wrap(t(`CLIENTE: ${data.customerName}`), RECEIPT_COLUMNS).map((text) => ({ text, bold: true })),
    { text: `HORA: ${timeFormat.format(data.createdAt)}` },
    { text: single },
    { text: twoColumns("QTD  ITEM", "VALOR") },
    { text: single },
  );

  for (const item of data.items) {
    const value = money(item.totalCents);
    const prefix = `${padStart(String(item.quantity), 2)}   `;
    const width = RECEIPT_COLUMNS - prefix.length - value.length - 1;
    // Descrição longa quebra em linhas seguintes, alinhadas após a quantidade.
    const [first = "", ...rest] = wrap(t(item.description), width);
    lines.push({ text: twoColumns(prefix + first, value) });
    for (const line of rest) lines.push({ text: " ".repeat(prefix.length) + line });
    for (const component of item.components) lines.push({ text: `     -> ${t(component)}`.slice(0, RECEIPT_COLUMNS) });
  }

  if (data.notes?.trim()) {
    lines.push(
      { text: "" },
      ...wrap(t(`*OBS: ${data.notes.trim()}*`), RECEIPT_COLUMNS).map((text) => ({ text, bold: true })),
    );
  }

  lines.push(
    { text: single },
    { text: twoColumns("TOTAL:", money(data.totalCents)), bold: true, tall: true },
    ...wrap(`PAGAMENTO: ${t(data.paymentLabel)}`, RECEIPT_COLUMNS).map((text) => ({ text })),
    { text: double },
    { text: "[ ] PREPARADO   [ ] ENTREGUE", align: "center" },
  );

  return lines;
}

/** Representação em texto puro (pré-visualização e fallback de impressão do sistema). */
export function receiptToText(lines: readonly ReceiptLine[]): string {
  return lines
    .map(({ text, align }) => {
      if (align !== "center") return text;
      const left = Math.max(0, Math.floor((RECEIPT_COLUMNS - text.length) / 2));
      return " ".repeat(left) + text;
    })
    .join("\n");
}
