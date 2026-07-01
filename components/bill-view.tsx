"use client";

import { PencilLine, Trash2, FileText } from "lucide-react";
import { PayPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Item {
  name?: string | null;
  hsn?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  gst?: number | null;
  amount?: number | null;
}

// Raw invoice row (snake_case from the DB) + optional parsed `raw` blob.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function BillView({
  row,
  onEdit,
  onDelete,
}: {
  row: Row;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const cur = row.currency || "INR";
  const m = (n: unknown) =>
    n === null || n === undefined || n === "" ? "—" : formatMoney(Number(n), cur);

  const raw = row.raw || {};
  const items: Item[] = Array.isArray(row.items) ? row.items : Array.isArray(raw.items) ? raw.items : [];

  const total = Number(row.total) || 0;
  const paid = Number(row.amount_paid) || 0;
  const balance = row.balance != null ? Number(row.balance) : Math.max(total - paid, 0);

  const hasBank = row.bank_name || row.bank_account || row.bank_ifsc;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {row.vendor_name || "—"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Invoice #{row.invoice_number || "—"}
            {row.invoice_date && <> · {formatDate(row.invoice_date)}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PayPill status={row.status || "unpaid"} />
          {row.has_pdf && (
            <a
              href={`/api/bill-file?id=${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
            >
              <FileText className="size-3.5" /> View PDF
            </a>
          )}
        </div>
      </div>

      {/* Amount summary */}
      <div className="flex items-end justify-between gap-4 border-y border-border py-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total amount</div>
          <div className="mt-1 text-3xl font-bold tracking-tight">{m(total)}</div>
        </div>
        <div className="space-y-1 text-right text-sm">
          <div className="flex items-center justify-end gap-6">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-medium">{m(paid)}</span>
          </div>
          <div className="flex items-center justify-end gap-6">
            <span className="text-muted-foreground">Balance</span>
            <span className={cn("font-medium", balance > 0 ? "text-danger" : "text-foreground")}>{m(balance)}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <Section title="Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Field k="Category" v={row.category} />
          <Field k="GSTIN" v={row.vendor_gstin} mono />
          <Field k="Invoice date" v={row.invoice_date ? formatDate(row.invoice_date) : null} />
          <Field k="Due date" v={row.due_date ? formatDate(row.due_date) : null} />
          <Field k="Place of supply" v={row.place_of_supply} />
          <Field k="Bill to" v={row.buyer} />
          <Field k="Buyer GSTIN" v={row.buyer_gstin} mono />
          <Field k="Email" v={raw.vendorEmail} />
          <Field k="Phone" v={raw.vendorPhone} />
        </div>
      </Section>

      {/* Line items */}
      <Section title={`Items${items.length ? ` (${items.length})` : ""}`}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items were listed on this bill.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Rate</th>
                  <th className="py-2 pl-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-foreground">{it.name || "Item"}</div>
                      {it.hsn && <div className="text-xs text-muted-foreground">HSN {it.hsn}</div>}
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{it.qty ?? "—"}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{it.unitPrice != null ? m(it.unitPrice) : "—"}</td>
                    <td className="py-2.5 pl-2 text-right font-medium">{it.amount != null ? m(it.amount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <dl className="mt-4 ml-auto max-w-[240px] space-y-2 text-sm">
          <Total k="Taxable" v={m(row.subtotal)} />
          {row.cgst != null && <Total k="CGST" v={m(row.cgst)} />}
          {row.sgst != null && <Total k="SGST" v={m(row.sgst)} />}
          {row.igst != null && <Total k="IGST" v={m(row.igst)} />}
          {row.gst != null && <Total k="GST" v={m(row.gst)} />}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="text-base font-bold">{m(total)}</dd>
          </div>
        </dl>
      </Section>

      {/* Bank details */}
      {hasBank && (
        <Section title="Vendor bank details">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field k="Bank" v={row.bank_name} />
            <Field k="Account" v={row.bank_account} mono />
            <Field k="IFSC" v={row.bank_ifsc} mono />
          </div>
        </Section>
      )}

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="flex gap-2 border-t border-border pt-5">
          {onEdit && (
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <PencilLine className="size-4" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              className="flex-1 border-danger/40 text-danger hover:bg-danger-soft"
              onClick={onDelete}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-sm text-muted-foreground">{k}</dt>
      <dd className={cn("min-w-0 break-words text-right text-sm font-medium text-foreground", mono && "font-mono text-xs")}>
        {v}
      </dd>
    </div>
  );
}

function Total({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
