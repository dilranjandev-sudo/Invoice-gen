"use client";

import { useEffect, useState } from "react";
import { Download, ReceiptText, Landmark, ArrowLeftRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatCardsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/utils";

interface GstData {
  totals: { bills: number; taxable: string; cgst: string; sgst: string; igst: string; total_gst: string; total: string };
  monthly: { label: string; gst: string }[];
  byVendor: { vendor: string; gst: string; taxable: string; bills: number }[];
  byRate: { rate: string; gst: string; taxable: string; bills: number }[];
  gstr3b: { month: string; taxable: string; cgst: string; sgst: string; igst: string; total_gst: string; bills: number }[];
  split: { intra: number; inter: number };
}

const n = (v: unknown) => Number(v) || 0;

export default function GstPage() {
  const [d, setD] = useState<GstData | null>(null);

  useEffect(() => {
    fetch("/api/gst").then((r) => r.json()).then((j) => (j.error ? null : setD(j))).catch(() => {});
  }, []);

  function exportCsv() {
    if (!d) return;
    const rows: string[] = [];
    rows.push("GST Input / ITC Summary");
    rows.push("");
    rows.push("Taxable Value,CGST,SGST,IGST,Total GST (ITC)");
    rows.push([n(d.totals.taxable), n(d.totals.cgst), n(d.totals.sgst), n(d.totals.igst), n(d.totals.total_gst)].join(","));
    rows.push("");
    rows.push("Vendor,Bills,Taxable Value,GST (ITC)");
    for (const v of d.byVendor) rows.push([`"${v.vendor}"`, v.bills, n(v.taxable), n(v.gst)].join(","));
    rows.push("");
    rows.push("Rate,Bills,Taxable Value,GST");
    for (const r of d.byRate) rows.push([r.rate, r.bills, n(r.taxable), n(r.gst)].join(","));
    rows.push("");
    rows.push("GSTR-3B Monthly (Eligible ITC)");
    rows.push("Month,Bills,Taxable,CGST,SGST,IGST,Total ITC");
    for (const m of d.gstr3b) rows.push([`"${m.month}"`, m.bills, n(m.taxable), n(m.cgst), n(m.sgst), n(m.igst), n(m.total_gst)].join(","));

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gst-itc-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!d) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="GST"
          description="Input GST (ITC) you've paid on bills — computed from your own data. No external service."
        />
        <StatCardsSkeleton count={4} />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const maxM = Math.max(...d.monthly.map((m) => n(m.gst)), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST"
        description="Input GST (ITC) you've paid on bills — computed from your own data. No external service."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Input GST (ITC claimable)" value={formatMoney(n(d.totals.total_gst))} icon={ReceiptText} tone="bg-primary-soft text-primary" strong />
        <StatCard label="Taxable value" value={formatMoney(n(d.totals.taxable))} icon={Landmark} tone="bg-surface-muted text-muted-foreground" />
        <StatCard label="CGST + SGST" value={formatMoney(n(d.totals.cgst) + n(d.totals.sgst))} icon={ArrowLeftRight} tone="bg-success-soft text-success" />
        <StatCard label="IGST" value={formatMoney(n(d.totals.igst))} icon={ArrowLeftRight} tone="bg-violet-soft text-violet" />
      </div>

      {/* Monthly + split */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h3 className="text-base font-semibold">Input GST — last 6 months</h3>
          <div className="mt-6 flex h-44 items-end gap-3">
            {d.monthly.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full max-w-[44px] items-end overflow-hidden rounded-md bg-surface-muted">
                  <div className="w-full rounded-md bg-gradient-to-t from-[#e41f07] to-[#ff8a72]" style={{ height: `${Math.max((n(m.gst) / maxM) * 100, 2)}%` }} title={formatMoney(n(m.gst))} />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-semibold">Intra vs Inter-state</h3>
          <div className="mt-4 space-y-4">
            <SplitRow label="CGST + SGST (intra-state)" value={d.split.intra} total={d.split.intra + d.split.inter} color="#16a34a" />
            <SplitRow label="IGST (inter-state)" value={d.split.inter} total={d.split.intra + d.split.inter} color="#7c3aed" />
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Based on which tax fields each bill carries.
          </div>
        </Card>
      </div>

      {/* By rate + by vendor */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h3 className="px-5 py-4 text-sm font-semibold">GST by rate</h3>
          <Table head={["Rate", "Bills", "Taxable", "GST"]}>
            {d.byRate.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-5 py-2.5 font-medium">{r.rate}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{r.bills}</td>
                <td className="px-5 py-2.5 text-right text-muted-foreground">{formatMoney(n(r.taxable))}</td>
                <td className="px-5 py-2.5 text-right font-medium">{formatMoney(n(r.gst))}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <h3 className="px-5 py-4 text-sm font-semibold">GST by vendor</h3>
          <Table head={["Vendor", "Bills", "GST (ITC)"]}>
            {d.byVendor.map((v, i) => (
              <tr key={i} className="border-t border-border">
                <td className="max-w-0 truncate px-5 py-2.5 font-medium">{v.vendor}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{v.bills}</td>
                <td className="px-5 py-2.5 text-right font-medium">{formatMoney(n(v.gst))}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {/* GSTR-3B monthly */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">GSTR-3B — Eligible ITC (monthly)</h3>
            <p className="text-xs text-muted-foreground">Table 4(A) input tax credit, month-wise. Hand this to your CA.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-t border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-2.5">Month</th>
                <th className="px-5 py-2.5 text-right">Bills</th>
                <th className="px-5 py-2.5 text-right">Taxable</th>
                <th className="px-5 py-2.5 text-right">CGST</th>
                <th className="px-5 py-2.5 text-right">SGST</th>
                <th className="px-5 py-2.5 text-right">IGST</th>
                <th className="px-5 py-2.5 text-right">Total ITC</th>
              </tr>
            </thead>
            <tbody>
              {d.gstr3b.filter((m) => n(m.total_gst) > 0 || m.bills > 0).map((m, i) => (
                <tr key={i} className="border-t border-border hover:bg-surface-muted/30">
                  <td className="px-5 py-2.5 font-medium">{m.month}</td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">{m.bills}</td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">{formatMoney(n(m.taxable))}</td>
                  <td className="px-5 py-2.5 text-right">{formatMoney(n(m.cgst))}</td>
                  <td className="px-5 py-2.5 text-right">{formatMoney(n(m.sgst))}</td>
                  <td className="px-5 py-2.5 text-right">{formatMoney(n(m.igst))}</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{formatMoney(n(m.total_gst))}</td>
                </tr>
              ))}
              {d.gstr3b.every((m) => n(m.total_gst) === 0 && m.bills === 0) && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No GST data yet — it fills as bills come in.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, strong }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string; strong?: boolean }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`grid size-10 shrink-0 place-items-center rounded-md ${tone}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className={`truncate tracking-tight ${strong ? "text-lg font-bold" : "text-base font-semibold"}`}>{value}</div>
      </div>
    </Card>
  );
}

function SplitRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatMoney(value)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: color }} />
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-t border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
          {head.map((h, i) => (
            <th key={i} className={`px-5 py-2.5 ${i >= 2 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
