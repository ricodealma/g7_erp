/** Valores monetários trafegam como centavos inteiros para evitar erro de ponto flutuante. */
export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: Cents): string {
  return brl.format(cents / 100);
}

/** Converte Decimal do Prisma (ou string "10.50") em centavos. */
export function toCents(value: { toString(): string } | string | number): Cents {
  return Math.round(Number(value.toString()) * 100);
}

/** Centavos -> string decimal aceita pelo Prisma ("10.50"). */
export function fromCents(cents: Cents): string {
  return (cents / 100).toFixed(2);
}
