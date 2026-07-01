"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Ban, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Rule {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  threshold: number | null;
  action: "reject" | "flag";
}
interface Rejected {
  id: string;
  source: string;
  vendor_name: string | null;
  invoice_number: string | null;
  total: string | number | null;
  reason: string;
  created_at: string;
}

const UNIT: Record<string, string> = { require_amount: "₹ min", min_confidence: "% min" };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [rejected, setRejected] = useState<Rejected[] | null>(null);

  const load = useCallback(async () => {
    const [r, rej] = await Promise.all([
      fetch("/api/rules").then((x) => x.json()),
      fetch("/api/rules/rejected").then((x) => x.json()),
    ]);
    setRules(Array.isArray(r) ? r : []);
    setRejected(Array.isArray(rej) ? rej : []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(key: string, patch: Partial<Rule>) {
    setRules((cur) => (cur ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
    try {
      const r = await fetch("/api/rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, ...patch }),
      });
      if (!r.ok) throw new Error();
    } catch {
      toast.error("Couldn't save rule");
      load();
    }
  }

  async function clearLog() {
    await fetch("/api/rules/rejected", { method: "DELETE" });
    setRejected([]);
    toast.success("Blocked log cleared");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules"
        description="Rules decide which bills are accepted, flagged, or blocked. Toggle or tune them — changes apply to the next upload or sync."
      />

      {/* Rules */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Bill validation rules</h2>
        </div>
        {rules === null ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rules.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        r.action === "reject" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
                      )}
                    >
                      {r.action === "reject" ? "Blocks" : "Flags"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.threshold != null && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="number"
                        defaultValue={r.threshold}
                        onBlur={(e) => save(r.key, { threshold: Number(e.target.value) })}
                        className="h-8 w-20 rounded-md border border-border-strong bg-surface px-2 text-right text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="w-10">{UNIT[r.key] ?? ""}</span>
                    </label>
                  )}
                  <Toggle on={r.enabled} onClick={() => save(r.key, { enabled: !r.enabled })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recently blocked */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Ban className="size-4 text-danger" />
            <h2 className="text-sm font-semibold">Recently blocked</h2>
            {rejected && rejected.length > 0 && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">{rejected.length}</span>
            )}
          </div>
          {rejected && rejected.length > 0 && (
            <button onClick={clearLog} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-danger">
              <Trash2 className="size-3.5" /> Clear
            </button>
          )}
        </div>
        {rejected === null ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rejected.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nothing blocked yet. Junk, ₹0, non-invoice and duplicate bills will show up here.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rejected.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {x.vendor_name || "Unknown"}{x.invoice_number ? ` · #${x.invoice_number}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {x.source} · {x.total != null ? formatMoney(Number(x.total)) : "₹0"} · {formatDate(x.created_at)}
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">
                  {x.reason}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
    </button>
  );
}
