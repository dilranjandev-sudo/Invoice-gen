"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  ClipboardCheck,
  Receipt,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton, StatCardsSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { useSync } from "@/components/sync-provider";
import { formatMoney, cn } from "@/lib/utils";

interface Stats {
  invoices: { n: number; total: string; outstanding: string; paid_amount: string; paid: number; partial: number; unpaid: number };
  payments: { n: number; total: string; expense_total: string; matched: number; approved: number; unmatched: number; expense: number; needs_action: number };
  vendors: { n: number };
  monthly: { label: string; total: string }[];
  trend: { paidThis: number; paidLast: number; expThis: number; expLast: number };
  recentInvoices: { invoice_number: string; vendor_name: string; total: string; status: string }[];
  recentPayments: { payee: string; amount: string; channel: string; status: string }[];
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
  const [err, setErr] = useState(false);
  const inFlight = useRef(false);
  const { run: runSync, running: syncing } = useSync();

  async function load(attempt = 0) {
    // Never let requests stack — a slow DB + retries/remounts would otherwise
    // fire many /api/stats at once and starve the connection pool.
    if (inFlight.current) return;
    inFlight.current = true;
    if (attempt === 0) setErr(false);
    try {
      const r = await fetch("/api/stats");
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setS(j);
      setErr(false);
      inFlight.current = false;
    } catch {
      inFlight.current = false;
      if (attempt < 4) setTimeout(() => load(attempt + 1), 1500 * (attempt + 1));
      else setErr(true);
    }
  }

  useEffect(() => {
    load();
    const onSync = () => load();
    window.addEventListener("payrecord:synced", onSync);
    return () => window.removeEventListener("payrecord:synced", onSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {s ? (
        <Body s={s} reload={() => load()} />
      ) : err ? (
        <Card className="p-12 text-center">
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Couldn&apos;t load the dashboard. The database may be waking up after a period of inactivity — please try again.
          </p>
          <Button className="mt-4" onClick={() => load()}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </Card>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}

function Body({ s, reload }: { s: Stats; reload: () => void }) {
  const outstanding = Number(s.invoices.outstanding);
  const paidAmount = Number(s.invoices.paid_amount);
  const billed = Number(s.invoices.total) || 1;
  const paidShare = Math.round((paidAmount / billed) * 100);
  const monthMax = Math.max(...s.monthly.map((m) => Number(m.total)), 1);
  const catMax = Math.max(...s.byCategory.map((c) => Number(c.total)), 1);
  const vendors = s.topVendors.filter((v) => Number(v.billed) > 0);
  const venMax = Math.max(...vendors.map((v) => Number(v.billed)), 1);

  const kpis = [
    { label: "Outstanding payables", value: formatMoney(outstanding), sub: `${s.invoices.unpaid + s.invoices.partial} bills unpaid`, icon: Receipt, tint: "bg-primary-soft text-primary" },
    { label: "Paid this month", value: formatMoney(s.trend.paidThis), trend: pct(s.trend.paidThis, s.trend.paidLast), icon: TrendingUp, tint: "bg-success-soft text-success" },
    { label: "To review", value: String(s.payments.needs_action), sub: "payments awaiting action", icon: ClipboardCheck, tint: "bg-warning-soft text-warning", href: "/review" },
    { label: "Expenses this month", value: formatMoney(s.trend.expThis), trend: pct(s.trend.expThis, s.trend.expLast), icon: Wallet, tint: "bg-info-soft text-info" },
  ];

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <div className={cn("grid size-11 place-items-center rounded-xl", k.tint)}>
                  <Icon className="size-5" />
                </div>
                {k.trend && (
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", k.trend.up ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {k.trend.up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{k.trend.txt}
                  </span>
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">{k.label}</div>
              <div className="mt-0.5 text-[1.55rem] font-bold tracking-tight text-foreground">{k.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{k.sub ?? "vs last month"}</div>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="card-hover rounded-2xl border border-border bg-surface p-5 shadow-card">{inner}</Link>
          ) : (
            <div key={k.label} className="rounded-2xl border border-border bg-surface p-5 shadow-card">{inner}</div>
          );
        })}
      </div>

      {/* Cash out + payables */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
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
          <div className="mt-6 flex h-48 items-end gap-3">
            {s.monthly.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full max-w-[46px] items-end overflow-hidden rounded-md bg-surface-muted">
                  <div className="w-full rounded-md bg-gradient-to-t from-[#e41f07] to-[#ff8a72] transition-all" style={{ height: `${Math.max((Number(m.total) / monthMax) * 100, 2)}%` }} title={formatMoney(Number(m.total))} />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Payables status</h3>
          <div className="mt-4 text-xs text-muted-foreground">Paid vs outstanding</div>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-success" style={{ width: `${paidShare}%` }} />
            <div className="h-full bg-primary" style={{ width: `${100 - paidShare}%` }} />
          </div>
          <ul className="mt-5 space-y-3.5 text-sm">
            <Row color="bg-success" label="Paid" right={formatMoney(paidAmount)} note={`${s.invoices.paid}`} />
            <Row color="bg-warning" label="Partially paid" right={`${s.invoices.partial} bill${s.invoices.partial === 1 ? "" : "s"}`} />
            <Row color="bg-primary" label="Unpaid" right={formatMoney(outstanding)} note={`${s.invoices.unpaid}`} />
          </ul>
        </Card>
      </div>

      {/* Top vendors + category */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Top vendors by spend</h3>
          <div className="mt-4 space-y-3">
            {vendors.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No vendor spend yet.</p>}
            {vendors.map((v) => (
              <div key={v.name} className="flex items-center gap-3">
                <Avatar name={v.name} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-foreground">{v.name}</span>
                    <span className="text-sm font-semibold text-foreground">{formatMoney(Number(v.billed))}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((Number(v.billed) / venMax) * 100, 3)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">Spend by category</h3>
          <div className="mt-4 space-y-3">
            {s.byCategory.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No spend yet.</p>}
            {s.byCategory.slice(0, 6).map((c) => {
              const color = CAT_COLOR[c.category] ?? "#94a3b8";
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <div className="flex w-36 shrink-0 items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-foreground">{c.category}</span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.max((Number(c.total) / catMax) * 100, 3)}%`, background: color }} />
                  </div>
                  <div className="w-24 shrink-0 text-right text-sm font-medium text-foreground">{formatMoney(Number(c.total))}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentCard title="Recent Bills" icon={FileText} href="/invoices" empty="No bills yet.">
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
        </RecentCard>
        <RecentCard title="Recent Payments" icon={CreditCard} href="/payments" empty="No payments yet.">
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
        </RecentCard>
      </div>
    </>
  );
}

function Row({ color, label, right, note }: { color: string; label: string; right: string; note?: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2.5">
        <span className={cn("size-2.5 rounded-full", color)} />
        <span className="text-foreground">{label}</span>
        {note && <span className="text-xs text-muted-foreground">· {note}</span>}
      </span>
      <span className="font-medium text-foreground">{right}</span>
    </li>
  );
}

function RecentCard({ title, icon: Icon, href, empty, children }: { title: string; icon: React.ElementType; href: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-muted-foreground" /> {title}</h2>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border border-t border-border">
          {children.length === 0 ? <tr><td className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</td></tr> : children}
        </tbody>
      </table>
    </Card>
  );
}

/* ---- Loading skeleton ----------------------------------------------------- */
function LoadingState() {
  return (
    <div className="space-y-5">
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-6 h-48 w-full" />
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
    </div>
  );
}
