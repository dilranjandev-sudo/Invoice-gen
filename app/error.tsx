"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [retrying, setRetrying] = useState(false);

  // Most failures here are a transient cold-start / DB pooler timeout that
  // clears on a retry. Auto-retry once, but not in a tight loop.
  useEffect(() => {
    let cancelled = false;
    try {
      const last = Number(sessionStorage.getItem("pr_last_retry") || "0");
      if (Date.now() - last > 5000) {
        sessionStorage.setItem("pr_last_retry", String(Date.now()));
        setRetrying(true);
        const t = setTimeout(() => {
          if (!cancelled) reset();
        }, 1200);
        return () => {
          cancelled = true;
          clearTimeout(t);
        };
      }
    } catch {
      /* sessionStorage unavailable — fall through to manual retry */
    }
  }, [reset]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        {retrying ? <Loader2 className="size-6 animate-spin" /> : <RefreshCw className="size-6" />}
      </div>
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {retrying ? "Reconnecting…" : "This page hit a snag"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {retrying ? "One moment — retrying automatically." : "It's usually a brief hiccup. Try again."}
        </p>
      </div>
      {!retrying && (
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[#1d4ed8]"
        >
          <RefreshCw className="size-4" /> Try again
        </button>
      )}
    </div>
  );
}
