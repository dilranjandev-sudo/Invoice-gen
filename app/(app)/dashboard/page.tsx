"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CreditCard,
  Users,
  FileText,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayPill } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { useSync } from "@/components/sync-provider";
import { formatMoney, cn } from "@/lib/utils";

interface Stats {
  invoices: { n: number; total: string; paid: number; partial: number; unpaid: number };
  payments: { n: number; total: string; matched: number; approved: number; unmatched: number };
  vendors: { n: number };
  monthly: { label: string; total: string }[];
  trend: {
    paidThis: number; paidLast: number;
    invThis: number; invLast: number;
    payThis: number; payLast: number;
    venThis: number; venLast: number;
  };
  recentInvoices: { invoice_number: string; vendor_name: string; total: string; status: string }[];
  recentPayments: { payee: string; amount: string; channel: string; status: string }[];
  byCategory: { category: string; total: string; count: number }[];
}

const CAT_COLOR: Record<string, string> = {
  Rent: "#2563eb", Utilities: "#0891b2", Software: "#7c3aed", Marketing: "#db2777",
  Travel: "#d97706", "Office Supplies": "#64748b", "Professional Fees": "#059669",
  Inventory: "#ea580c", Logistics: "#0d9488", Telecom: "#4f46e5", Other: "#94a3b8",
  Uncategorized: "#cbd5e1",
};

function pct(now: number, prev: number): { txt: string; up: boolean } {
  if (prev <= 0) return { txt: now > 0 ? "New" : "—", up: true };
  const ch = Math.round(((now - prev) / prev) * 100);
  return { txt: `${ch >= 0 ? "+" : ""}${ch}%`, up: ch >= 0 };
}

export default function DashboardPage() {
  const [s, setS] = useState<Stats | null>(null);
  const { run: runSync, running: syncing } = useSync();

  async function load(attempt = 0) {
    try {
      const r = await fetch("/api/stats");
      const j = await r.json();
      if (!j.error) {
        setS(j);
        return;
      }
      throw new Error(j.error);
    } catch {
      // Retry a couple of times — covers a cold-start / DB pooler hiccup.
      if (attempt < 3) setTimeout(() => load(attempt + 1), 1200 * (attempt + 1));
    }
  }

  useEffect(() => {
    load();
    const onSync = () => load();
    window.addEventListener("payrecord:synced", onSync);
    return () => window.removeEventListener("payrecord:synced", onSync);
  }, []);

  if (!s) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  const cards = [
    { label: "Total Paid", value: formatMoney(Number(s.payments.total)), trend: pct(s.trend.paidThis, s.trend.paidLast), icon: TrendingUp, top: "bg-emerald-50", solid: "bg-emerald-500", text: "text-emerald-600" },
    { label: "Payments", value: String(s.payments.n), trend: pct(s.trend.payThis, s.trend.payLast), icon: CreditCard, top: "bg-rose-50", solid: "bg-rose-500", text: "text-rose-600" },
    { label: "Vendors", value: String(s.vendors.n), trend: pct(s.trend.venThis, s.trend.venLast), icon: Users, top: "bg-violet-50", solid: "bg-violet-500", text: "text-violet-600" },
    { label: "Bills", value: String(s.invoices.n), trend: pct(s.trend.invThis, s.trend.invLast), icon: FileText, top: "bg-amber-50", solid: "bg-amber-500", text: "text-amber-600" },
  ];

  const payTotal = s.payments.n || 1;
  const matchedRate = Math.round(((s.payments.matched + s.payments.approved) / payTotal) * 100);
  const unmatchedRate = Math.round((s.payments.unmatched / payTotal) * 100);

  const max = Math.max(...s.monthly.map((m) => Number(m.total)), 1);

  const donut = [
    { label: "Paid", value: s.invoices.paid, color: "#16a34a" },
    { label: "Partially Paid", value: s.invoices.partial, color: "#f59e0b" },
    { label: "Unpaid", value: s.invoices.unpaid, color: "#ef4444" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Live overview of your payments and bills."
        actions={
          <Button variant="outline" onClick={runSync} disabled={syncing}>
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        }
      />

      {/* Row 1: stat cards + status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="animate-rise card-hover rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className={cn("grid size-11 place-items-center rounded-xl text-white shadow-sm", c.solid)}>
                  <Icon className="size-5" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    c.trend.up ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                  )}
                >
                  {c.trend.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                  {c.trend.txt}
                </span>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">{c.label}</div>
              <div className="mt-0.5 text-[1.6rem] font-bold tracking-tight">{c.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">vs last month</div>
            </div>
          );
        })}

        {/* Status card */}
        <Card className="p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Payment Status</h3>
            <button onClick={() => load()} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-surface-muted">
              <RefreshCw className="size-4" />
            </button>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Sparkline up />
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-2xl font-bold">
                  {matchedRate}% <ArrowUp className="size-4 text-emerald-600" />
                </div>
                <div className="text-xs text-muted-foreground">Matched</div>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <Sparkline />
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-2xl font-bold">
                  {unmatchedRate}% <ArrowDown className="size-4 text-rose-600" />
                </div>
                <div className="text-xs text-muted-foreground">Unmatched</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: bar + donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <h3 className="text-base font-semibold">Payments — last 6 months</h3>
          <div className="mt-6 flex h-48 items-end gap-3">
            {s.monthly.map((m, i) => {
              const h = (Number(m.total) / max) * 100;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full max-w-[44px] items-end overflow-hidden rounded-md bg-surface-muted">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-[#e41f07] to-[#ff8a72]"
                      style={{ height: `${Math.max(h, 2)}%` }}
                      title={formatMoney(Number(m.total))}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold">Invoice Status</h3>
          <div className="mt-2 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <Donut segments={donut} total={s.invoices.n} />
            <ul className="flex-1 space-y-3">
              {donut.map((d) => (
                <li key={d.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                    {d.label}
                  </span>
                  <span className="font-medium text-muted-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Spend by category */}
      {s.byCategory && s.byCategory.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold">Spend by category</h3>
          <div className="mt-4 space-y-3">
            {(() => {
              const catMax = Math.max(...s.byCategory.map((x) => Number(x.total)), 1);
              return s.byCategory.slice(0, 8).map((cbrk) => {
                const val = Number(cbrk.total);
                const w = (val / catMax) * 100;
                const color = CAT_COLOR[cbrk.category] ?? "#94a3b8";
                return (
                  <div key={cbrk.category} className="flex items-center gap-3">
                    <div className="flex w-40 shrink-0 items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="truncate">{cbrk.category}</span>
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(w, 2)}%`, background: color }} />
                    </div>
                    <div className="w-24 shrink-0 text-right text-sm font-medium">{formatMoney(val)}</div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      )}

      {/* Recent */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold">Recent Bills</h2>
            <Link href="/invoices" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border border-t border-border">
              {s.recentInvoices.length === 0 && <tr><td className="px-5 py-8 text-center text-sm text-muted-foreground">No bills yet.</td></tr>}
              {s.recentInvoices.map((i, idx) => (
                <tr key={idx} className="hover:bg-surface-muted/30">
                  <td className="px-5 py-3 text-muted-foreground">{i.vendor_name}</td>
                  <td className="px-5 py-3 font-medium">{formatMoney(Number(i.total))}</td>
                  <td className="px-5 py-3 text-right"><PayPill status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold">Recent Payments</h2>
            <Link href="/payments" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border border-t border-border">
              {s.recentPayments.length === 0 && <tr><td className="px-5 py-8 text-center text-sm text-muted-foreground">No payments yet.</td></tr>}
              {s.recentPayments.map((p, idx) => (
                <tr key={idx} className="hover:bg-surface-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{p.payee || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.channel || ""}</div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">{formatMoney(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Sparkline({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-28">
      <path
        d={up ? "M2 30 L22 24 L42 26 L62 14 L82 18 L100 6 L118 4" : "M2 8 L22 14 L42 12 L62 22 L82 18 L100 28 L118 30"}
        fill="none"
        stroke={up ? "#16a34a" : "#ef4444"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Donut({ segments, total }: { segments: { value: number; color: string }[]; total: number }) {
  const sum = segments.reduce((a, x) => a + x.value, 0);
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="size-40 shrink-0">
      <g transform="rotate(-90 80 80)">
        {sum === 0 ? (
          <circle cx="80" cy="80" r={r} fill="none" stroke="#e6e9ef" strokeWidth="22" />
        ) : (
          segments.map((seg, i) => {
            const len = (seg.value / sum) * c;
            const el = (
              <circle
                key={i}
                cx="80" cy="80" r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="22"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })
        )}
      </g>
      <text x="80" y="74" textAnchor="middle" className="fill-current text-[11px] text-muted-foreground">Total</text>
      <text x="80" y="96" textAnchor="middle" className="fill-current text-xl font-bold">{total}</text>
    </svg>
  );
}
