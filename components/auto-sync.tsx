"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Silently syncs Gmail (which also auto-matches) on an interval while the app
 * is open. In production a server cron would hit /api/gmail/sync instead.
 */
export function AutoSync({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const busy = useRef(false);

  useEffect(() => {
    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await fetch("/api/gmail/sync", { method: "POST" });
        if (r.ok) {
          const j = await r.json();
          if (j.synced > 0) {
            toast.success(`Auto-sync — ${j.synced} new payment${j.synced === 1 ? "" : "s"}`);
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
