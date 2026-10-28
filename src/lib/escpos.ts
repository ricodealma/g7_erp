import type { ReceiptLine } from "./receipt";
import { toPrinterText } from "./text";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Codificador ESC/POS mínimo para impressoras MTP-II de 58 mm. Usa apenas comandos
 * universais (inicializar, alinhar, negrito, altura dupla, avanço) e texto ASCII.
 */
export function encodeReceipt(lines: readonly ReceiptLine[], feedLines = 4): Uint8Array {
  const bytes: number[] = [ESC, 0x40]; // ESC @ — reinicia a impressora

  for (const line of lines) {
    bytes.push(ESC, 0x61, line.align === "center" ? 1 : 0); // ESC a n — alinhamento
    bytes.push(ESC, 0x45, line.bold ? 1 : 0); // ESC E n — negrito
    bytes.push(GS, 0x21, line.tall ? 0x01 : 0x00); // GS ! n — altura dupla
    for (const char of toPrinterText(line.text)) bytes.push(char.charCodeAt(0));
    bytes.push(LF);
  }

  bytes.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0);
  bytes.push(ESC, 0x64, feedLines); // ESC d n — avança papel para destacar

  return Uint8Array.from(bytes);
}
