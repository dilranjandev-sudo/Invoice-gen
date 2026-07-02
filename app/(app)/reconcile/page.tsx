"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Landmark, CheckCircle2, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Line {
  date: string | null;
  description: string | null;
  amount: number | null;
  direction: "debit" | "credit";
  ref: string | null;
  matchPaymentId: string | null;
  matchPayee: string | null;
  matchScore: number | null;
  // client-side flags
  _done?: "reconciled" | "added";
}

export default function ReconcilePage() {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File) {
    if (f.size > 8 * 1024 * 1024) return toast.error("File too large — keep it under 8 MB.");
    const reader = new FileReader();
    reader.onload = () => run(String(reader.result));
    reader.readAsDataURL(f);
  }

  async function run(dataUrl: string) {
    setLoading(true);
    setLines(null);
    try {
      const r = await fetch("/api/reconcile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: dataUrl }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setLines(j.lines);
      toast.success(`${j.total} transactions read — ${j.matched} matched`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function confirm(i: number, l: Line) {
    if (!l.matchPaymentId) return;
    setBusy(i);
    try {
      await fetch("/api/payments", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: l.matchPaymentId, action: "reconcile", value: true }) });
      setLines((cur) => (cur ?? []).map((x, idx) => (idx === i ? { ...x, _done: "reconciled" } : x)));
      toast.success("Reconciled");
    } finally {
      setBusy(null);
    }
  }

  async function add(i: number, l: Line) {
    setBusy(i);
    try {
      await fetch("/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payee: l.description || "Bank debit", amount: l.amount, paidOn: l.date, ref: l.ref }) });
      setLines((cur) => (cur ?? []).map((x, idx) => (idx === i ? { ...x, _done: "added" } : x)));
      toast.success("Added as a payment");
    } finally {
      setBusy(null);
    }
  }

  const matched = (lines ?? []).filter((l) => l.matchPaymentId).length;
  const unmatched = (lines ?? []).filter((l) => l.direction === "debit" && !l.matchPaymentId).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bank Reconciliation"
        description="Upload a bank statement (CSV or PDF) — AI reads each line and matches it to your recorded payments."
        actions={<Button onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{loading ? "Reading…" : "Upload statement"}</Button>}
      />
      <input ref={inputRef} type="file" accept=".csv,.pdf,.txt,text/csv,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />

      {lines === null ? (
        loading ? (
          <Card className="flex items-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> AI is reading your statement…</Card>
        ) : (
          <Card className="border-dashed px-6 py-16 text-center">
            <Landmark className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Upload your bank statement — CSV or PDF, any bank.</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()}><Upload className="size-4" /> Upload statement</Button>
          </Card>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3.5 p-4"><div className="grid size-11 place-items-center rounded-xl bg-surface-muted text-muted-foreground"><Landmark className="size-5" /></div><div><div className="text-xs text-muted-foreground">Transactions</div><div className="text-lg font-semibold">{lines.length}</div></div></Card>
            <Card className="flex items-center gap-3.5 p-4"><div className="grid size-11 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 className="size-5" /></div><div><div className="text-xs text-muted-foreground">Matched</div><div className="text-lg font-semibold">{matched}</div></div></Card>
            <Card className="flex items-center gap-3.5 p-4"><div className="grid size-11 place-items-center rounded-xl bg-warning-soft text-warning"><Plus className="size-5" /></div><div><div className="text-xs text-muted-foreground">Unrecorded debits</div><div className="text-lg font-semibold">{unmatched}</div></div></Card>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Description</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l, i) => (
                    <tr key={i} className="hover:bg-surface-muted/30">
                      <td className="px-5 py-3 text-muted-foreground">{l.date ? formatDate(l.date) : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {l.direction === "debit" ? <ArrowUpRight className="size-3.5 text-danger" /> : <ArrowDownLeft className="size-3.5 text-success" />}
                          <span className="max-w-[280px] truncate">{l.description || "—"}</span>
                        </div>
                        {l.ref && <div className="ml-5 font-mono text-[11px] text-muted-foreground">{l.ref}</div>}
                      </td>
                      <td className={cn("px-5 py-3 text-right font-medium", l.direction === "debit" ? "text-foreground" : "text-success")}>{l.amount != null ? formatMoney(l.amount) : "—"}</td>
                      <td className="px-5 py-3">
                        {l._done === "reconciled" ? <Chip tone="success">Reconciled</Chip>
                          : l._done === "added" ? <Chip tone="success">Added</Chip>
                          : l.direction === "credit" ? <Chip tone="muted">Incoming</Chip>
                          : l.matchPaymentId ? <Chip tone="success">Matched · {l.matchPayee || "payment"}</Chip>
                          : <Chip tone="warning">Not recorded</Chip>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!l._done && l.direction === "debit" && (
                          l.matchPaymentId ? (
                            <Button size="sm" variant="outline" disabled={busy === i} onClick={() => confirm(i, l)}>{busy === i ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Confirm</Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy === i} onClick={() => add(i, l)}>{busy === i ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add payment</Button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ tone, children }: { tone: "success" | "warning" | "muted"; children: React.ReactNode }) {
  const cls = tone === "success" ? "bg-success-soft text-success" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface-muted text-muted-foreground";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>;
}
