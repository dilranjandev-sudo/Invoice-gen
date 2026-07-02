"use client";

import { useEffect } from "react";

// Registers the service worker so PayRecord can be installed to a phone/desktop.
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
