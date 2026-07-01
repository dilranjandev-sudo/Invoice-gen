"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AutoSyncToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [paymentDays, setPaymentDays] = useState("1");
  const [billDays, setBillDays] = useState("60");
  const [paymentFrom, setPaymentFrom] = useState("axis.bank.in");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setOn(s?.auto_sync_enabled !== "false");
        if (s?.payment_days) setPaymentDays(String(s.payment_days));
        if (s?.bill_days) setBillDays(String(s.bill_days));
        if (s?.payment_from) setPaymentFrom(String(s.payment_from));
      })
      .catch(() => setOn(true));
  }, []);

  async function put(key: string, value: string) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    } catch {
      toast.error("Couldn't save");
    }
  }

  async function toggle() {
    const next = !on;
    setOn(next);
    await put("auto_sync_enabled", next ? "true" : "false");
    toast.success(next ? "Auto-sync turned on" : "Auto-sync turned off");
  }

  async function saveDays(key: string, raw: string, fallback: string, setter: (v: string) => void) {
    let n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n < 1) n = Number(fallback);
    if (n > 365) n = 365;
    setter(String(n));
    await put(key, String(n));
    toast.success("Fetch window updated");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="size-4 text-muted-foreground" /> Automation &amp; Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Auto-sync from Gmail</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Pull payments &amp; bills every 5 minutes while the app is open. Off = sync only manually.
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={on === null}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
              on ? "bg-primary" : "bg-border-strong"
            )}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
          </button>
        </div>

        <div className="border-t border-border" />

        {/* Payment sender */}
        <div>
          <div className="text-sm font-medium">Payment emails from</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Only read payment alerts from this bank/sender (e.g. your bank&apos;s domain). Comma-separate for more.
          </div>
          <input
            type="text"
            value={paymentFrom}
            onChange={(e) => setPaymentFrom(e.target.value)}
            onBlur={(e) => {
              const v = e.target.value.trim() || "axis.bank.in";
              setPaymentFrom(v);
              put("payment_from", v);
              toast.success("Payment sender updated");
            }}
            placeholder="axis.bank.in"
            className="mt-2 h-9 w-full max-w-sm rounded-md border border-border-strong bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="border-t border-border" />

        {/* Fetch window */}
        <div>
          <div className="text-sm font-medium">How far back to fetch</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            From how many days of email PayRecord reads. Bigger = more history but more AI usage.
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2.5">
              <span className="text-sm">Payments — last</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={paymentDays}
                  onChange={(e) => setPaymentDays(e.target.value)}
                  onBlur={(e) => saveDays("payment_days", e.target.value, "1", setPaymentDays)}
                  className="h-8 w-16 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2.5">
              <span className="text-sm">Bills — last</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={billDays}
                  onChange={(e) => setBillDays(e.target.value)}
                  onBlur={(e) => saveDays("bill_days", e.target.value, "60", setBillDays)}
                  className="h-8 w-16 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
