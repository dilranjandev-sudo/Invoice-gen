"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  ClipboardCheck,
  Receipt,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ArrowRight,
  Users,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useSync } from "@/components/sync-provider";
import { formatMoney, cn } from "@/lib/utils";

interface Stats {
  invoices: { n: number; total: string; outstanding: string; paid_amount: string; paid: number; partial: number; unpaid: number };
  payments: { n: number; total: string; expense_total: string; matched: number; approved: number; unmatched: number; expense: number; needs_action: number };
  vendors: { n: number };
  monthly: { label: string; total: string }[];
  trend: {
    paidThis: number; paidLast: number; expThis: number; expLast: number;
    invThis: number; invLast: number; payThis: number; payLast: number; venThis: number; venLast: number;
  };
  recentInvoices: { invoice_number: string; vendor_name: string; total: string; status: string; due_date: string | null }[];
  recentPayments: { payee: string; amount: string; channel: string; status: string; match_score: string | null }[];
  topVendors: { name: string; billed: string; invoices: number }[];
  byCategory: { category: string; total: string; count: number }[];
}

const CAT_COLOR: Record<string, string> = {
  Rent: "#e41f07", Utilities: "#0891b2", Software: "#7c3aed", Marketing: "#db2777",
  Travel: "#d97706", "Office Supplies": "#64748b", "Professional Fees": "#0e9384",
  Inventory: "#ef5e25", Logistics: "#0e9384", Telecom: "#3538cd", Other: "#94a3b8",
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
      if (!j.error) return setS(j);
      throw new Error(j.error);
    } catch {
      if (attempt < 3) setTimeout(() => load(attempt + 1), 1200 * (attempt + 1));
    }
  }

  useEffect(() => {
    load();
    const onSync = () => load();
    window.addEventListener("payrecord:synced", onSync);
    return () => window.removeEventListener("payrecord:synced", onSync);
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Your payables at a glance — what's owed, what's paid, what needs action."
        actions={
          <Button variant="outline" onClick={runSync} disabled={syncing}>
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        }
      />

      {!s ? <DashboardSkeleton /> : <DashboardBody s={s} reload={() => load()} />}
    </div>
  );
}

function DashboardBody({ s, reload }: { s: Stats; reload: () => void }) {
  const outstanding = Number(s.invoices.outstanding);
  const paidAmount = Number(s.invoices.paid_amount);
  const billedTotal = Number(s.invoices.total) || 1;
  const paidShare = Math.round((paidAmount / billedTotal) * 100);

  const kpis = [
    {
      label: "Outstanding payables",
      value: formatMoney(outstanding),
      sub: `${s.invoices.unpaid + s.invoices.partial} bill${s.invoices.unpaid + s.invoices.partial === 1 ? "" : "s"} unpaid`,
      icon: Receipt,
      tint: "bg-primary-soft text-primary",
    },
    {
      label: "Paid this month",
      value: formatMoney(s.trend.paidThis),
      trend: pct(s.trend.paidThis, s.trend.paidLast),
      icon: TrendingUp,
      tint: "bg-success-soft text-success",
    },
    {
      label: "To review",
      value: String(s.payments.needs_action),
      sub: "payments awaiting action",
      icon: ClipboardCheck,
      tint: "bg-warning-soft text-warning",
      href: "/review",
    },
    {
      label: "Expenses this month",
      value: formatMoney(s.trend.expThis),
      trend: pct(s.trend.expThis, s.trend.expLast),
      icon: Wallet,
      tint: "bg-info-soft text-info",
    },
  ];

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const body = (
            <>
              <div className="flex items-center justify-between">
                <div className={cn("grid size-11 place-items-center rounded-xl", k.tint)}>
                  <Icon className="size-5" />
                </div>
                {k.trend && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", k.trend.up ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {k.trend.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {k.trend.txt}
                  </span>
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">{k.label}</div>
              <div className="mt-0.5 text-[1.55rem] font-bold tracking-tight text-foreground">{k.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{k.sub ?? (k.trend ? "vs last month" : "")}</div>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="animate-rise card-hover rounded-2xl border border-border bg-surface p-5 shadow-card">{body}</Link>
          ) : (
            <div key={k.label} className="animate-rise card-hover rounded-2xl border border-border bg-surface p-5 shadow-card">{body}</div>
          );
        })}
      </div>

      {/* Cash out chart + payables status */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Cash out</h3>
              <p className="text-xs text-muted-foreground">Payments made — last 6 months</p>
            </div>
            <button onClick={reload} className="grid size-9 place-items-center rounded-md border border-border-strong text-muted-foreground hover:bg-primary-soft hover:text-primary">
              <RefreshCw className="size-4" />
            </button>
          </div>
          <AreaChart data={s.monthly.map((m) => ({ label: m.label, total: Number(m.total) }))} />
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Payables status</h3>
          <div className="mt-4">
            <div className="text-xs text-muted-foreground">Paid vs outstanding</div>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full bg-success" style={{ width: `${paidShare}%` }} />
              <div className="h-full bg-primary" style={{ width: `${100 - paidShare}%` }} />
            </div>
          </div>
          <ul className="mt-5 space-y-3.5 text-sm">
            <StatusRow color="bg-success" label="Paid" amount={formatMoney(paidAmount)} count={s.invoices.paid} />
            <StatusRow color="bg-warning" label="Partially paid" amount={`${s.invoices.partial} bill${s.invoices.partial === 1 ? "" : "s"}`} />
            <StatusRow color="bg-primary" label="Unpaid" amount={formatMoney(outstanding)} count={s.invoices.unpaid} />
          </ul>
        </Card>
      </div>

      {/* Top vendors + category */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Top vendors by spend</h3>
          <div className="mt-4 space-y-3">
            {s.topVendors.filter((v) => Number(v.billed) > 0).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No vendor spend yet.</p>
            )}
            {(() => {
              const vs = s.topVendors.filter((v) => Number(v.billed) > 0);
              const max = Math.max(...vs.map((v) => Number(v.billed)), 1);
              return vs.map((v) => (
                <div key={v.name} className="flex items-center gap-3">
                  <Avatar name={v.name} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-foreground">{v.name}</span>
                      <span className="text-sm font-semibold text-foreground">{formatMoney(Number(v.billed))}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((Number(v.billed) / max) * 100, 3)}%` }} />
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Spend by category</h3>
          <div className="mt-4 space-y-3">
            {s.byCategory.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No spend yet.</p>}
            {(() => {
              const catMax = Math.max(...s.byCategory.map((x) => Number(x.total)), 1);
              return s.byCategory.slice(0, 6).map((c) => {
                const val = Number(c.total);
                const color = CAT_COLOR[c.category] ?? "#94a3b8";
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="truncate text-foreground">{c.category}</span>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.max((val / catMax) * 100, 3)}%`, background: color }} />
                    </div>
                    <div className="w-24 shrink-0 text-right text-sm font-medium text-foreground">{formatMoney(val)}</div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-muted-foreground" /> Recent Bills</h2>
            <Link href="/invoices" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border border-t border-border">
              {s.recentInvoices.length === 0 && <tr><td className="px-5 py-8 text-center text-sm text-muted-foreground">No bills yet.</td></tr>}
              {s.recentInvoices.map((i, idx) => (
                <tr key={idx} className="hover:bg-surface-muted/40">
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{i.vendor_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">#{i.invoice_number || "—"}</div>
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{formatMoney(Number(i.total))}</td>
                  <td className="px-5 py-3 text-right"><PayPill status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Users className="size-4 text-muted-foreground" /> Recent Payments</h2>
            <Link href="/payments" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border border-t border-border">
              {s.recentPayments.length === 0 && <tr><td className="px-5 py-8 text-center text-sm text-muted-foreground">No payments yet.</td></tr>}
              {s.recentPayments.map((p, idx) => (
                <tr key={idx} className="hover:bg-surface-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.payee || "—"} className="size-8" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{p.payee || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.channel || p.status}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">{formatMoney(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function StatusRow({ color, label, amount, count }: { color: string; label: string; amount: string; count?: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2.5">
        <span className={cn("size-2.5 rounded-full", color)} />
        <span className="text-foreground">{label}</span>
        {count != null && <span className="text-xs text-muted-foreground">· {count}</span>}
      </span>
      <span className="font-medium text-foreground">{amount}</span>
    </li>
  );
}

/* Smooth-ish SVG area chart for the 6-month cash-out trend. */
function AreaChart({ data }: { data: { label: string; total: number }[] }) {
  const w = 580, h = 200, padX = 26, top = 16, bottom = 28;
  const max = Math.max(...data.map((d) => d.total), 1);
  const n = Math.max(data.length, 1);
  const x = (i: number) => (n === 1 ? w / 2 : padX + (i * (w - 2 * padX)) / (n - 1));
  const y = (v: number) => top + (1 - v / max) * (h - top - bottom);
  const pts = data.map((d, i) => [x(i), y(d.total)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L ${x(n - 1).toFixed(1)} ${h - bottom} L ${x(0).toFixed(1)} ${h - bottom} Z` : "";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full">
      <defs>
        <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e41f07" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e41f07" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={padX} x2={w - padX} y1={top + g * (h - top - bottom)} y2={top + g * (h - top - bottom)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {area && <path d={area} fill="url(#cashArea)" />}
      {area && <path d={line} fill="none" stroke="#e41f07" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke="#e41f07" strokeWidth="2" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - 8} textAnchor="middle" className="fill-current text-muted-foreground" style={{ fontSize: 10 }}>{d.label}</text>
      ))}
    </svg>
  );
}

/* ---- Skeleton while stats load -------------------------------------------- */
function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <Skeleton className="size-11 rounded-xl" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-3.5 w-28" />
            <Skeleton className="mt-2 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-6 h-44 w-full" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mt-4 flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="mt-4 flex items-center gap-3"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-16" /></div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
