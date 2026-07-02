"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Scale, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatCardsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/utils";

interface TdsData {
  totalTds: number;
  totalBase: number;
  bySection: { section: string; label: string; base: number; tds: number; vendors: number }[];
  vendors: { id: string; name: string; section: string; rate: number; base: number; tds: number; bills: number }[];
}

export default function TdsPage() {
  const [d, setD] = useState<TdsData | null>(null);

  useEffect(() => {
    fetch("/api/tds").then((r) => r.json()).then((j) => (j.error ? null : setD(j))).catch(() => {});
  }, []);

  function exportCsv() {
    if (!d) return;
    const rows = ["TDS Payable Summary", "", "Section,Vendors,Taxable Base,TDS"];
    for (const s of d.bySection) rows.push([s.section, s.vendors, s.base, s.tds].join(","));
    rows.push("", "Vendor,Section,Rate %,Base,TDS");
    for (const v of d.vendors) rows.push([`"${v.name}"`, v.section, v.rate, v.base, v.tds].join(","));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tds-summary.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!d) return (
    <div className="space-y-6">
      <PageHeader
        title="TDS"
        description="Tax deducted at source on vendor payments — by section. Set each vendor's section on the Vendors page."
      />
      <StatCardsSkeleton count={4} />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="TDS"
        description="Tax deducted at source on vendor payments — by section. Set each vendor's section on the Vendors page."
        actions={<Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><Scale className="size-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">Total TDS to deduct</div>
            <div className="text-lg font-bold tracking-tight">{formatMoney(d.totalTds)}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-muted text-muted-foreground"><Scale className="size-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">On taxable base</div>
            <div className="text-lg font-semibold tracking-tight">{formatMoney(d.totalBase)}</div>
          </div>
        </Card>
      </div>

      {d.vendors.length === 0 ? (
        <Card className="flex items-start gap-3 p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm text-muted-foreground">
            No TDS set yet. Open a vendor on the <Link href="/vendors" className="font-medium text-primary hover:underline">Vendors</Link> page and choose its TDS
            section (194C, 194J, 194I…). TDS is then computed automatically here.
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <h3 className="px-5 py-4 text-sm font-semibold">By section</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-2.5">Section</th>
                  <th className="px-5 py-2.5 text-right">Vendors</th>
                  <th className="px-5 py-2.5 text-right">Base</th>
                  <th className="px-5 py-2.5 text-right">TDS</th>
                </tr>
              </thead>
              <tbody>
                {d.bySection.map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-5 py-2.5 font-medium">{s.label}</td>
                    <td className="px-5 py-2.5 text-right text-muted-foreground">{s.vendors}</td>
                    <td className="px-5 py-2.5 text-right text-muted-foreground">{formatMoney(s.base)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{formatMoney(s.tds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-hidden">
            <h3 className="px-5 py-4 text-sm font-semibold">By vendor</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-t border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-5 py-2.5">Vendor</th>
                    <th className="px-5 py-2.5">Section</th>
                    <th className="px-5 py-2.5 text-right">Rate</th>
                    <th className="px-5 py-2.5 text-right">Base</th>
                    <th className="px-5 py-2.5 text-right">TDS</th>
                  </tr>
                </thead>
                <tbody>
                  {d.vendors.map((v) => (
                    <tr key={v.id} className="border-t border-border hover:bg-surface-muted/30">
                      <td className="max-w-0 truncate px-5 py-2.5 font-medium">{v.name}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{v.section}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">{v.rate}%</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">{formatMoney(v.base)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold">{formatMoney(v.tds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
