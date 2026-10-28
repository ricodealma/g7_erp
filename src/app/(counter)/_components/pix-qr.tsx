"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import { buildPixPayload } from "@/lib/pix";

export function PixQr({
  pixKey,
  merchantName,
  merchantCity,
  amountCents,
}: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
}) {
  const payload = useMemo(
    () => buildPixPayload({ key: pixKey, merchantName, merchantCity, amountCents }),
    [pixKey, merchantName, merchantCity, amountCents],
  );
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((markup) => {
      if (active) setSvg(markup);
    });
    return () => {
      active = false;
    };
  }, [payload]);

  if (!pixKey) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-2 text-zinc-900">
      <div
        className="size-28 shrink-0 [&>svg]:size-full"
        aria-label="QR Code Pix"
        role="img"
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className="min-w-0 text-xs">
        <p className="font-semibold">Pix com valor</p>
        <p className="break-all opacity-70">{pixKey}</p>
        <button
          type="button"
          className="mt-1 font-medium text-amber-700 underline"
          onClick={() => navigator.clipboard?.writeText(payload)}
        >
          Copiar código
        </button>
      </div>
    </div>
  );
}
