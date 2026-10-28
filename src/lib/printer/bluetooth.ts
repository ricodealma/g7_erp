/**
 * Conexão com a impressora térmica via Web Bluetooth (RF-01/RF-02).
 * Estado global de módulo exposto via `subscribe`/`getState` para `useSyncExternalStore`.
 */

/** Serviços BLE conhecidos da família GOOJPRT PT-210 / MTP-II (ver requisitos). */
export const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

/** Tamanho de bloco seguro para o MTU padrão do BLE. */
const CHUNK_SIZE = 100;

export type PrinterStatus = "unsupported" | "disconnected" | "connecting" | "connected";
export type PrinterState = { status: PrinterStatus; deviceName: string | null; error: string | null };

let device: BluetoothDevice | null = null;
let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
let state: PrinterState = { status: "disconnected", deviceName: null, error: null };
const listeners = new Set<() => void>();

function setState(next: Partial<PrinterState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): PrinterState {
  return state;
}

const SERVER_STATE: PrinterState = { status: "unsupported", deviceName: null, error: null };
export function getServerState(): PrinterState {
  return SERVER_STATE;
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer) {
  for (const service of await server.getPrimaryServices()) {
    for (const candidate of await service.getCharacteristics()) {
      if (candidate.properties.writeWithoutResponse || candidate.properties.write) return candidate;
    }
  }
  return null;
}

async function attach(target: BluetoothDevice) {
  setState({ status: "connecting", error: null, deviceName: target.name ?? "Impressora" });
  const server = await target.gatt!.connect();
  const writable = await findWritableCharacteristic(server);
  if (!writable) {
    server.disconnect();
    throw new Error("A impressora não expõe uma característica BLE de escrita.");
  }
  device = target;
  characteristic = writable;
  target.addEventListener("gattserverdisconnected", () => {
    characteristic = null;
    setState({ status: "disconnected" });
  });
  setState({ status: "connected" });
}

/** Abre o seletor do navegador (exige gesto do usuário). */
export async function connectPrinter() {
  if (!isBluetoothSupported()) {
    setState({ status: "unsupported" });
    return;
  }
  try {
    const selected = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });
    await attach(selected);
  } catch (error) {
    // Usuário fechou o seletor: não é erro.
    const cancelled = error instanceof DOMException && error.name === "NotFoundError";
    setState({ status: "disconnected", error: cancelled ? null : (error as Error).message });
  }
}

/** Reconecta sem seletor quando o navegador suporta `getDevices()` (permissão já concedida). */
export async function reconnectPrinter() {
  if (!isBluetoothSupported() || state.status === "connected") return;
  try {
    if (device) {
      await attach(device);
      return;
    }
    if (typeof navigator.bluetooth.getDevices !== "function") return;
    const [known] = await navigator.bluetooth.getDevices();
    if (known) await attach(known);
  } catch (error) {
    setState({ status: "disconnected", error: (error as Error).message });
  }
}

export function disconnectPrinter() {
  device?.gatt?.disconnect();
}

export async function printBytes(bytes: Uint8Array) {
  if (!characteristic) await reconnectPrinter();
  if (!characteristic) throw new Error("Impressora desconectada.");

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }
  }
}
