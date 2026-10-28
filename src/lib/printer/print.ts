import { encodeReceipt } from "@/lib/escpos";
import { buildReceipt, receiptToText, type ReceiptData } from "@/lib/receipt";

import { getState, printBytes } from "./bluetooth";

export type PrintOutcome = "bluetooth" | "system";

/** Fallback (RF-02): imprime o cupom pelo diálogo nativo do sistema via iframe oculto. */
export function printWithSystemDialog(receipt: ReceiptData) {
  const text = receiptToText(buildReceipt(receipt));
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument!;
  const pre = doc.createElement("pre");
  pre.textContent = text;
  const style = doc.createElement("style");
  style.textContent =
    "@page{size:58mm auto;margin:2mm}body{margin:0}pre{font:12px/1.25 ui-monospace,monospace;margin:0;white-space:pre}";
  doc.head.appendChild(style);
  doc.body.appendChild(pre);

  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 1000);
}

/** Imprime pela impressora Bluetooth se conectada; caso contrário usa o diálogo do sistema. */
export async function printReceipt(receipt: ReceiptData): Promise<PrintOutcome> {
  if (getState().status === "connected") {
    await printBytes(encodeReceipt(buildReceipt(receipt)));
    return "bluetooth";
  }
  printWithSystemDialog(receipt);
  return "system";
}
