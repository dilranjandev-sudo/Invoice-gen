"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Item {
  id: string;
  payee: string | null;
  amount: string | number | null;
  currency: string | null;
  paid_on: string | null;
  channel: string | null;
  mode: string | null;
  reference: string | null;
  utr: string | null;
  source_email: string | null;
  account_detail: string | null;
  match_score: string | number | null;
  matched_invoice_no: string | null;
  matched_invoice_total: string | number | null;
}

export default function ReviewPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/payments");
      const j = await r.json();
      setItems(Array.isArray(j) ? j.filter((p: { status: string }) => p.status === "matched") : []);
    } catch {
      setItems([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const r = await fetch("/api/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: id, action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      if (action === "approve") {
        toast.success(j.emailed ? "Approved — confirmation emailed to vendor" : "Approved & marked paid");
      } else {
        toast.success("Marked as not a match");
      }
      setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const score = (s: string | number | null) => (s != null ? Math.round(Number(s)) : null);
  const cur = (it: Item) => it.currency || "INR";

  const pendingTotal = (items ?? []).reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="To Review"
        description="Confirm each payment is matched to the right bill, then approve in one click."
      />

      {/* Summary strip */}
      {items && items.length > 0 && (
        <div className="flex items-center gap-6 rounded-md border border-border bg-surface px-5 py-3.5 shadow-card">
          <div>
            <div className="text-xs text-muted-foreground">Awaiting approval</div>
            <div className="text-lg font-semibold">{items.length} payment{items.length === 1 ? "" : "s"}</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="text-xs text-muted-foreground">Total value</div>
            <div className="text-lg font-semibold">{formatMoney(pendingTotal, "INR")}</div>
          </div>
        </div>
      )}

      {items === null && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-md border border-border bg-surface px-6 py-20 text-center shadow-card">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="mt-4 text-base font-semibold">You&apos;re all caught up</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Nothing to review right now. New matched payments will appear here automatically.
          </div>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((it) => {
            const sc = score(it.match_score);
            const strong = sc != null && sc >= 90;
            const billTotal = it.matched_invoice_total != null ? Number(it.matched_invoice_total) : null;
            const payAmt = it.amount != null ? Number(it.amount) : null;
            const diff = billTotal != null && payAmt != null ? Math.abs(billTotal - payAmt) : null;
            const exact = diff != null && diff < 0.5;
            const method = [it.mode || it.channel, it.paid_on ? formatDate(it.paid_on) : null]
              .filter(Boolean)
              .join(" · ");
            const ref = it.utr || it.reference;

            return (
              <div key={it.id} className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={it.payee || "Vendor"} className="size-9" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{it.payee || "Vendor"}</div>
                      {it.source_email && (
                        <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Mail className="size-3" /> {it.source_email}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                      strong ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", strong ? "bg-success" : "bg-warning")} />
                    {sc != null ? `${sc}% match` : "Matched"}
                  </span>
                </div>

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-px border-y border-border bg-border">
                  <div className="bg-surface px-5 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill</div>
                    <div className="mt-1 text-xl font-bold tracking-tight">
                      {billTotal != null ? formatMoney(billTotal, cur(it)) : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">Invoice #{it.matched_invoice_no || "—"}</div>
                  </div>
                  <div className="bg-surface px-5 py-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Payment</div>
                    <div className="mt-1 text-xl font-bold tracking-tight">
                      {payAmt != null ? formatMoney(payAmt, cur(it)) : "—"}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{method || "—"}</div>
                    {ref && <div className="truncate text-xs text-muted-foreground">Ref {ref}</div>}
                  </div>
                </div>

                {/* Verify line */}
                <div
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 text-sm font-medium",
                    exact ? "text-success" : "text-warning"
                  )}
                >
                  {exact ? (
                    <>
                      <CheckCircle2 className="size-4" /> Amounts match exactly
                    </>
                  ) : diff != null ? (
                    <>
                      <AlertTriangle className="size-4" /> Difference of {formatMoney(diff, cur(it))} — please check
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4" /> Bill total unavailable — review before approving
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
                  <Button variant="outline" disabled={busy === it.id} onClick={() => act(it.id, "reject")}>
                    <X className="size-4" /> Not a match
                  </Button>
                  <Button
                    disabled={busy === it.id}
                    className="bg-success hover:bg-[#15803d]"
                    onClick={() => act(it.id, "approve")}
                  >
                    {busy === it.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approve &amp; mark paid
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
