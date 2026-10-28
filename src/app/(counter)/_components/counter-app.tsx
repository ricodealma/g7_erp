"use client";

import { AlertTriangle, Bluetooth, BluetoothConnected, ClipboardList, Package, UtensilsCrossed, WifiOff } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { connectPrinter, disconnectPrinter, getState as getPrinterState, reconnectPrinter } from "@/lib/printer/bluetooth";
import { printReceipt } from "@/lib/printer/print";
import type { ReceiptData } from "@/lib/receipt";
import type { CounterSnapshot } from "@/server/counter/queries";

import { closeEventAction } from "../actions";
import { MenuDialog, ReceiptDialog, StockDialog } from "./dialogs";
import { useOnline, usePrinter } from "./hooks";
import { isLowStock, NewOrder } from "./new-order";
import { OpenEvent } from "./open-event";
import { OrdersList } from "./orders-list";
import { Button } from "./ui";

function PrinterButton() {
  const printer = usePrinter();
  if (printer.status === "unsupported") {
    return (
      <span className="text-xs opacity-60" title="Use Chrome no Android/desktop ou o Bluefy no iOS">
        Sem Bluetooth
      </span>
    );
  }
  const connected = printer.status === "connected";
  return (
    <Button
      variant={connected ? "success" : "secondary"}
      disabled={printer.status === "connecting"}
      onClick={() => (connected ? disconnectPrinter() : connectPrinter())}
      title={printer.error ?? undefined}
      aria-label={connected ? "Desconectar impressora" : "Conectar impressora"}
    >
      {connected ? <BluetoothConnected size={18} /> : <Bluetooth size={18} />}
      <span className="hidden sm:inline">
        {printer.status === "connecting" ? "Conectando…" : connected ? (printer.deviceName ?? "Impressora") : "Conectar impressora"}
      </span>
    </Button>
  );
}

export function CounterApp({ snapshot }: { snapshot: CounterSnapshot }) {
  const online = useOnline();
  const [tab, setTab] = useState<"new" | "orders">("new");
  const [dialog, setDialog] = useState<"menu" | "stock" | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [closing, startClosing] = useTransition();

  useEffect(() => {
    void reconnectPrinter();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!snapshot.event) {
    return <OpenEvent snacks={snapshot.products.filter((product) => product.category === "SNACK")} />;
  }

  const lowStock = snapshot.products.filter((product) => product.inMenu && isLowStock(product));
  const openOrders = snapshot.orders.filter((order) => order.status === "PENDING" || order.status === "READY").length;

  /** Imprime via Bluetooth; sem impressora, abre a pré-visualização com as alternativas. */
  async function print(data: ReceiptData, successMessage: string) {
    if (getPrinterState().status === "connected") {
      try {
        await printReceipt(data);
        setToast({ message: successMessage });
        return;
      } catch (error) {
        setToast({ message: `Falha na impressão: ${(error as Error).message}`, error: true });
      }
    }
    setReceipt(data);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {!online && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          <WifiOff size={16} /> Sem conexão — novos pedidos bloqueados. Siga com a operação manual.
        </div>
      )}

      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mr-auto min-w-0">
          <p className="truncate font-bold">{snapshot.event.name}</p>
          <p className="text-xs opacity-60">{new Date(`${snapshot.event.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>
        </div>
        <PrinterButton />
        <Button onClick={() => setDialog("menu")} aria-label="Cardápio do dia">
          <UtensilsCrossed size={18} /> <span className="hidden sm:inline">Cardápio</span>
        </Button>
        <Button onClick={() => setDialog("stock")} aria-label="Estoque" className={lowStock.length ? "!bg-red-600 !text-white" : ""}>
          <Package size={18} /> <span className="hidden sm:inline">Estoque</span>
          {lowStock.length > 0 && <span className="font-bold">{lowStock.length}</span>}
        </Button>
        <Button
          variant="ghost"
          disabled={closing}
          onClick={() => {
            if (!window.confirm(`Encerrar o evento "${snapshot.event!.name}"?`)) return;
            startClosing(async () => {
              const result = await closeEventAction();
              if (!result.ok) setToast({ message: result.error, error: true });
            });
          }}
        >
          Encerrar
        </Button>
      </header>

      {lowStock.length > 0 && (
        <button
          type="button"
          onClick={() => setDialog("stock")}
          className="flex items-center gap-2 bg-red-50 px-4 py-2 text-left text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Estoque crítico:{" "}
            {lowStock.map((product) => `${product.name} (${product.stockQuantity})`).join(", ")}
          </span>
        </button>
      )}

      <nav className="flex gap-2 px-4 pt-3" aria-label="Seções">
        <Button variant={tab === "new" ? "primary" : "secondary"} onClick={() => setTab("new")}>
          Novo pedido
        </Button>
        <Button variant={tab === "orders" ? "primary" : "secondary"} onClick={() => setTab("orders")}>
          <ClipboardList size={18} /> Pedidos {openOrders > 0 && <span className="font-bold">({openOrders})</span>}
        </Button>
      </nav>

      <main className="flex flex-1 flex-col p-4">
        {tab === "new" ? (
          <NewOrder
            snapshot={snapshot}
            online={online}
            onCreated={({ number, receipt }) => void print(receipt, `Pedido #${String(number).padStart(3, "0")} impresso.`)}
          />
        ) : (
          <OrdersList
            orders={snapshot.orders}
            onReprint={(data) => void print(data, "Cupom reimpresso.")}
            onError={(message) => setToast({ message, error: true })}
          />
        )}
      </main>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.error ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          }`}
        >
          {toast.message}
        </div>
      )}

      <MenuDialog open={dialog === "menu"} onClose={() => setDialog(null)} products={snapshot.products} />
      <StockDialog open={dialog === "stock"} onClose={() => setDialog(null)} products={snapshot.products} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
