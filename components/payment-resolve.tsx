"use client";

import { useMemo, useState } from "react";
import { Search, Loader2, FileText, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Select, Field, Textarea } from "@/components/ui/input";
import { rankMatches, type MatchInvoice } from "@/lib/match";
import { EXPENSE_CATEGORIES } from "@/lib/expense";
import { formatMoney, formatDate, cn } from "@/lib/utils";

export interface ResolvePayment {
  id: string;
  payee: string | null;
  amount: string | number | null;
  currency?: string | null;
  paid_on?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResolveInvoice = MatchInvoice & Record<string, any>;

/* -------------------------------------------------------------------------- */
/* Link-to-bill picker                                                        */
/* -------------------------------------------------------------------------- */

export function LinkBillDrawer({
  open,
  onClose,
  payment,
  invoices,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  payment: ResolvePayment | null;
  invoices: ResolveInvoice[];
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const ranked = useMemo(() => {
    if (!payment) return [];
    // Only bills that aren't fully paid are worth linking.
    const open = invoices.filter((i) => i.status !== "paid");
    const scored = rankMatches(
      { id: payment.id, payee: payment.payee, amount: payment.amount, paid_on: payment.paid_on ?? null },
      open
    );
    if (!q.trim()) return scored;
    const needle = q.toLowerCase();
    return scored.filter(({ invoice }) =>
      [invoice.vendor_name, invoice.invoice_number, String(invoice.total)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [payment, invoices, q]);

  async function link(invoiceId: string) {
    if (!payment) return;
    setBusy(invoiceId);
    try {
      const r = await fetch("/api/payments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: payment.id, action: "link", invoiceId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      toast.success("Linked to bill — now ready to approve");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const cur = payment?.currency || "INR";
  const payAmt = payment?.amount != null ? Number(payment.amount) : null;

  return (
    <Drawer open={open} onClose={onClose} title="Link payment to a bill" width="max-w-lg">
      {payment && (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{payment.payee || "Payment"}</div>
                {payment.paid_on && <div className="text-xs text-muted-foreground">{formatDate(payment.paid_on)}</div>}
              </div>
              <div className="text-lg font-bold tabular-nums">{payAmt != null ? formatMoney(payAmt, cur) : "—"}</div>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search bills by vendor, invoice #, amount…"
              className="h-10 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {ranked.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No open bills to link. Upload the bill first, then link it here.
            </div>
          ) : (
            <div className="space-y-2">
              {ranked.map(({ invoice, score }) => {
                const billTotal = invoice.total != null ? Number(invoice.total) : null;
                const exact = billTotal != null && payAmt != null && Math.abs(billTotal - payAmt) < 0.5;
                return (
                  <button
                    key={invoice.id}
                    onClick={() => link(invoice.id)}
                    disabled={busy !== null}
                    className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/30 disabled:opacity-60"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{invoice.vendor_name || "Unknown vendor"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        #{invoice.invoice_number || "—"}
                        {invoice.invoice_date ? ` · ${formatDate(invoice.invoice_date)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {billTotal != null ? formatMoney(billTotal, invoice.currency || cur) : "—"}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[11px]">
                        {exact ? (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-success">
                            <CheckCircle2 className="size-3" /> exact
                          </span>
                        ) : (
                          <span className={cn("font-medium", score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted-foreground")}>
                            {score}% match
                          </span>
                        )}
                      </div>
                    </div>
                    {busy === invoice.id && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/* Mark-as-expense dialog                                                     */
/* -------------------------------------------------------------------------- */

export function ExpenseDrawer({
  open,
  onClose,
  payment,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  payment: ResolvePayment | null;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<string>("Salary");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!payment) return;
    setSaving(true);
    try {
      const r = await fetch("/api/payments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: payment.id, action: "expense", category, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      toast.success(`Marked as ${category} — no bill needed`);
      setNote("");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const payAmt = payment?.amount != null ? Number(payment.amount) : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Mark as direct expense"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save expense"}</Button>
        </>
      }
    >
      {payment && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted/40 p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <Wallet className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{payment.payee || "Payment"}</div>
              {payment.paid_on && <div className="text-xs text-muted-foreground">{formatDate(payment.paid_on)}</div>}
            </div>
            <div className="text-lg font-bold tabular-nums">{payAmt != null ? formatMoney(payAmt, payment.currency || "INR") : "—"}</div>
          </div>

          <p className="text-sm text-muted-foreground">
            Use this for payments that have no vendor bill — salary, rent, taxes, bank charges. It will be recorded as an
            expense and won&apos;t wait for a match.
          </p>

          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)" hint="e.g. employee name & month, or what this was for">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Salary — Rahul, June 2026" />
          </Field>
        </div>
      )}
    </Drawer>
  );
}
