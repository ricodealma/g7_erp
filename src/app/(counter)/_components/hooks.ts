"use client";

import { useSyncExternalStore } from "react";

import { getServerState, getState, subscribe } from "@/lib/printer/bluetooth";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** RNF-06: o sistema é somente online. */
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function usePrinter() {
  return useSyncExternalStore(subscribe, getState, getServerState);
}
