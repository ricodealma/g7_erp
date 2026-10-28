import type { Cents } from "./money";
import { toPrinterText } from "./text";

/** CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

export type PixParams = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amountCents: Cents;
};

/** Gera o "Pix copia e cola" estático (BR Code / EMV-MPM) com valor definido. */
export function buildPixPayload({ key, merchantName, merchantCity, amountCents }: PixParams): string {
  const payload =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", key.trim())) +
    field("52", "0000") +
    field("53", "986") +
    (amountCents > 0 ? field("54", (amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", toPrinterText(merchantName).slice(0, 25)) +
    field("60", toPrinterText(merchantCity).slice(0, 15)) +
    field("62", field("05", "***")) +
    "6304";
  return payload + crc16(payload);
}
