"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Mail,
  Link2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { LinkBillDrawer, ExpenseDrawer, type ResolveInvoice } from "@/components/payment-resolve";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  status: string;
  source_email: string | null;
  account_detail: string | null;
  match_score: string | number | null;
  matched_invoice_id: string | null;
  matched_invoice_no: string | null;
  matched_invoice_total: string | number | null;
}
interface Flag { key: string; label: string; severity: "high" | "medium" }

export default function ReviewPage() {
  const [all, setAll] = useState<Item[] | null>(null);
  const [invoices, setInvoices] = useState<ResolveInvoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<Item | null>(null);
  const [expenseFor, setExpenseFor] = useState<Item | null>(null);
  const [flags, setFlags] = useState<Record<string, Flag[]>>({});

  async function load() {
    try {
      const [pr, ir] = await Promise.all([fetch("/api/payments"), fetch("/api/invoices")]);
      const pj = await pr.json();
      const ij = await ir.json();
      const list: Item[] = Array.isArray(pj) ? pj : [];
      setAll(list);
      setInvoices(Array.isArray(ij) ? ij : []);
      // Anomaly flags for the matched bills (safety check before approving).
      const ids = list.filter((p) => p.status === "matched" && p.matched_invoice_id).map((p) => p.matched_invoice_id!);
      if (ids.length) {
        fetch("/api/anomaly", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoiceIds: ids }) })
          .then((r) => r.json()).then((j) => setFlags(j?.flags ?? {})).catch(() => {});
      }
    } catch {
      setAll([]);
    }
  }
  useEffect(() => {
    load();
    window.addEventListener("payrecord:synced", load);
    return () => window.removeEventListener("payrecord:synced", load);
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
        toast.success("Unlinked — moved back to needs action");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const score = (s: string | number | null) => (s != null ? Math.round(Number(s)) : null);
  const cur = (it: Item) => it.currency || "INR";

  const needsAction = (all ?? []).filter((p) => p.status === "unmatched");
  const ready = (all ?? []).filter((p) => p.status === "matched");
  const pendingTotal = ready.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const nothing = all && needsAction.length === 0 && ready.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="To Review"
        description="Link each payment to its bill (or mark it as a direct expense), then approve."
      />

      {/* Summary strip */}
      {all && !nothing && (
        <div className="flex flex-wrap items-center gap-6 rounded-md border border-border bg-surface px-5 py-3.5 shadow-card">
          <div>
            <div className="text-xs text-muted-foreground">Needs action</div>
            <div className="text-lg font-semibold">{needsAction.length}</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="text-xs text-muted-foreground">Ready to approve</div>
            <div className="text-lg font-semibold">{ready.length}</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <div className="text-xs text-muted-foreground">Awaiting value</div>
            <div className="text-lg font-semibold">{formatMoney(pendingTotal, "INR")}</div>
          </div>
        </div>
      )}

      {all === null && <TableSkeleton rows={4} />}

      {nothing && (
        <div className="rounded-md border border-border bg-surface px-6 py-20 text-center shadow-card">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="mt-4 text-base font-semibold">You&apos;re all caught up</div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Nothing to review right now. New payments will appear here automatically after each sync.
          </div>
        </div>
      )}

      {/* ---- Needs action: link to a bill or mark as expense ---- */}
      {needsAction.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="grid size-5 place-items-center rounded-full bg-warning-soft text-warning">
              <AlertTriangle className="size-3" />
            </span>
            Needs action · {needsAction.length}
          </h2>
          <div className="space-y-2.5">
            {needsAction.map((it) => {
              const amt = it.amount != null ? Number(it.amount) : null;
              const method = [it.mode || it.channel, it.paid_on ? formatDate(it.paid_on) : null].filter(Boolean).join(" · ");
              return (
                <div key={it.id} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={it.payee || "Payment"} className="size-9" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.payee || "Unknown"}</div>
                      <div className="truncate text-xs text-muted-foreground">{method || "—"}{it.utr || it.reference ? ` · Ref ${it.utr || it.reference}` : ""}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold tabular-nums sm:mr-2">{amt != null ? formatMoney(amt, cur(it)) : "—"}</div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onClick={() => setLinkFor(it)}>
                      <Link2 className="size-4" /> Link to bill
                    </Button>
                    <Button variant="outline" onClick={() => setExpenseFor(it)}>
                      <Wallet className="size-4" /> Expense
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Ready to approve ---- */}
      {ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
              <Check className="size-3" />
            </span>
            Ready to approve · {ready.length}
          </h2>
          <div className="space-y-4">
            {ready.map((it) => {
              const sc = score(it.match_score);
              const strong = sc != null && sc >= 90;
              const billTotal = it.matched_invoice_total != null ? Number(it.matched_invoice_total) : null;
              const payAmt = it.amount != null ? Number(it.amount) : null;
              const diff = billTotal != null && payAmt != null ? Math.abs(billTotal - payAmt) : null;
              const exact = diff != null && diff < 0.5;
              const method = [it.mode || it.channel, it.paid_on ? formatDate(it.paid_on) : null].filter(Boolean).join(" · ");
              const ref = it.utr || it.reference;

              return (
                <div key={it.id} className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
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
                    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", strong ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                      <span className={cn("size-1.5 rounded-full", strong ? "bg-success" : "bg-warning")} />
                      {sc != null ? `${sc}% match` : "Matched"}
                    </span>
                  </div>

                  {it.matched_invoice_id && (flags[it.matched_invoice_id]?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-2.5">
                      {flags[it.matched_invoice_id].map((f) => (
                        <span key={f.key} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", f.severity === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                          <AlertTriangle className="size-3" /> {f.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-px border-y border-border bg-border">
                    <div className="bg-surface px-5 py-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill</div>
                      <div className="mt-1 text-xl font-bold tracking-tight">{billTotal != null ? formatMoney(billTotal, cur(it)) : "—"}</div>
                      <div className="text-sm text-muted-foreground">Invoice #{it.matched_invoice_no || "—"}</div>
                    </div>
                    <div className="bg-surface px-5 py-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Payment</div>
                      <div className="mt-1 text-xl font-bold tracking-tight">{payAmt != null ? formatMoney(payAmt, cur(it)) : "—"}</div>
                      <div className="truncate text-sm text-muted-foreground">{method || "—"}</div>
                      {ref && <div className="truncate text-xs text-muted-foreground">Ref {ref}</div>}
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-2 px-5 py-2.5 text-sm font-medium", exact ? "text-success" : "text-warning")}>
                    {exact ? (
                      <><CheckCircle2 className="size-4" /> Amounts match exactly</>
                    ) : diff != null ? (
                      <><AlertTriangle className="size-4" /> Difference of {formatMoney(diff, cur(it))} — please check</>
                    ) : (
                      <><AlertTriangle className="size-4" /> Bill total unavailable — review before approving</>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
                    <Button variant="outline" disabled={busy === it.id} onClick={() => act(it.id, "reject")}>
                      <X className="size-4" /> Unlink
                    </Button>
                    <Button disabled={busy === it.id} className="bg-success hover:bg-[#15803d]" onClick={() => act(it.id, "approve")}>
                      {busy === it.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Approve &amp; mark paid
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <LinkBillDrawer open={linkFor !== null} onClose={() => setLinkFor(null)} payment={linkFor} invoices={invoices} onDone={load} />
      <ExpenseDrawer open={expenseFor !== null} onClose={() => setExpenseFor(null)} payment={expenseFor} onDone={load} />
    </div>
  );
}
