"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Silently runs the full Gmail sync (bills + payments + matching) on an interval
 * while the app is open. In production a server cron would hit /api/gmail/sync-all.
 */
export function AutoSync({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const busy = useRef(false);

  useEffect(() => {
    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await fetch("/api/gmail/sync-all", { method: "POST" });
        if (r.ok) {
          const j = await r.json();
          const p = j.payments?.synced ?? 0;
          const b = j.bills?.imported ?? 0;
          if (p > 0 || b > 0) {
            const parts = [];
            if (p > 0) parts.push(`${p} payment${p === 1 ? "" : "s"}`);
            if (b > 0) parts.push(`${b} bill${b === 1 ? "" : "s"}`);
            toast.success(`Auto-sync — ${parts.join(" · ")}`);
            window.dispatchEvent(new Event("payrecord:synced"));
          }
        }
      } catch {
        /* offline / no account — ignore */
      } finally {
        busy.current = false;
      }
    }
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return null;
}
