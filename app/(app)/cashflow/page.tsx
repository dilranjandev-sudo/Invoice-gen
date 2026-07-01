"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, AlertTriangle, CalendarClock, Flame, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Bill { id: string; invoice_number: string | null; vendor_name: string | null; due: number; due_date: string | null }
interface Bucket { label: string; amount: number; count: number; bills: Bill[] }
interface CashData {
  outstanding: number;
  buckets: { overdue: Bucket; week: Bucket; month: Bucket; later: Bucket };
  burn: { label: string; amount: string }[];
  avgBurn: number;
}

export default function CashFlowPage() {
  const [d, setD] = useState<CashData | null>(null);
  const [balance, setBalance] = useState("");

  useEffect(() => {
    fetch("/api/cashflow").then((r) => r.json()).then((j) => (j.error ? null : setD(j))).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((s) => s?.cash_balance && setBalance(String(s.cash_balance))).catch(() => {});
  }, []);

  function saveBalance(v: string) {
    fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "cash_balance", value: v }) });
    toast.success("Cash balance updated");
  }

  if (!d) {
    return <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading cash flow…</div>;
  }

  const bal = Number(balance) || 0;
  const runway = d.avgBurn > 0 && bal > 0 ? bal / d.avgBurn : null;
  const bk = d.buckets;
  const maxB = Math.max(...d.burn.map((m) => Number(m.amount)), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Flow" description="What you owe, when it's due, and how fast you're spending — your runway at a glance." />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total outstanding" value={formatMoney(d.outstanding)} icon={Wallet} tone="bg-primary-soft text-primary" />
        <Kpi label="Overdue" value={formatMoney(bk.overdue.amount)} sub={`${bk.overdue.count} bill${bk.overdue.count === 1 ? "" : "s"}`} icon={AlertTriangle} tone="bg-danger-soft text-danger" />
        <Kpi label="Due this month" value={formatMoney(bk.week.amount + bk.month.amount)} icon={CalendarClock} tone="bg-warning-soft text-warning" />
        <Kpi label="Avg monthly burn" value={formatMoney(d.avgBurn)} sub="last 3 months" icon={Flame} tone="bg-orange-soft text-orange" />
      </div>

      {/* Runway + burn */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-primary" />
            <h3 className="text-base font-semibold">Runway</h3>
          </div>
          <label className="mt-4 block text-xs font-medium text-muted-foreground">Cash in bank</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">₹</span>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onBlur={(e) => saveBalance(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="mt-5 rounded-md bg-surface-muted/50 p-4 text-center">
            {runway != null ? (
              <>
                <div className={cn("text-3xl font-bold tracking-tight", runway < 3 ? "text-danger" : runway < 6 ? "text-warning" : "text-success")}>
                  {runway.toFixed(1)} <span className="text-base font-medium text-muted-foreground">months</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">at ~{formatMoney(d.avgBurn)}/month burn</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Enter your cash balance to see runway.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold">Monthly burn — last 6 months</h3>
          <div className="mt-6 flex h-40 items-end gap-3">
            {d.burn.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full max-w-[44px] items-end overflow-hidden rounded-md bg-surface-muted">
                  <div className="w-full rounded-md bg-gradient-to-t from-[#ea580c] to-[#fdba74]" style={{ height: `${Math.max((Number(m.amount) / maxB) * 100, 2)}%` }} title={formatMoney(Number(m.amount))} />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Upcoming payments */}
      <Card className="overflow-hidden">
        <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">Upcoming payments</h3>
        <div className="divide-y divide-border">
          {([bk.overdue, bk.week, bk.month, bk.later] as Bucket[]).map((b, i) => (
            <BucketRow key={i} bucket={b} danger={i === 0} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-md", tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold tracking-tight">{value}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}

function BucketRow({ bucket, danger }: { bucket: Bucket; danger?: boolean }) {
  if (bucket.count === 0) return null;
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-semibold", danger && "text-danger")}>{bucket.label}</span>
        <span className="text-sm font-semibold">{formatMoney(bucket.amount)} <span className="text-xs font-normal text-muted-foreground">· {bucket.count}</span></span>
      </div>
      <div className="mt-2 space-y-1">
        {bucket.bills.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-sm">
            <span className="truncate text-muted-foreground">
              {b.vendor_name || "Unknown"}{b.invoice_number ? ` · #${b.invoice_number}` : ""}
              {b.due_date && <span className="text-xs"> · {formatDate(b.due_date)}</span>}
            </span>
            <span className="shrink-0 font-medium">{formatMoney(b.due)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
