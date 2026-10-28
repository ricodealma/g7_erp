"use client";

import { useState } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";
import type { SettingsInput } from "@/server/admin/schemas";

import { updateSettingsAction } from "../actions";
import { Card } from "../_components/shared";

const FIELDS: { key: keyof SettingsInput; label: string; maxLength: number; hint?: string }[] = [
  { key: "pixKey", label: "Chave Pix", maxLength: 140 },
  {
    key: "pixMerchant",
    label: "Nome do recebedor (Pix)",
    maxLength: 25,
    hint: "Até 25 caracteres, sem acentos de preferência.",
  },
  { key: "pixCity", label: "Cidade do recebedor (Pix)", maxLength: 15, hint: "Até 15 caracteres." },
  {
    key: "receiptHeader",
    label: "Cabeçalho do cupom",
    maxLength: 32,
    hint: "Até 32 caracteres (largura da bobina de 58 mm).",
  },
];

export function SettingsForm({ settings }: { settings: SettingsInput }) {
  const { pending, error, run } = useAction();
  const [values, setValues] = useState(settings);
  const [saved, setSaved] = useState(false);

  return (
    <Card className="max-w-lg">
      {FIELDS.map((field) => (
        <Field key={field.key} label={field.label}>
          <input
            className={inputClass}
            value={values[field.key]}
            maxLength={field.maxLength}
            onChange={(event) => {
              setSaved(false);
              setValues({ ...values, [field.key]: event.target.value });
            }}
          />
          {field.hint && <span className="text-xs font-normal opacity-60">{field.hint}</span>}
        </Field>
      ))}
      <ErrorText error={error} />
      {saved && <p className="text-sm text-emerald-600">Configurações salvas.</p>}
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          run(
            () => updateSettingsAction(values),
            () => setSaved(true),
          )
        }
      >
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </Card>
  );
}
