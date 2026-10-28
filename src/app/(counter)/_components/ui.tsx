"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-600",
  secondary:
    "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 active:bg-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  ghost: "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800",
  danger: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Modal baseado no <dialog> nativo (foco, ESC e backdrop gerenciados pelo navegador). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/60 dark:bg-zinc-900 dark:text-zinc-100`}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" onClick={onClose} aria-label="Fechar" className="!min-h-9 !px-3">
              ✕
            </Button>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
