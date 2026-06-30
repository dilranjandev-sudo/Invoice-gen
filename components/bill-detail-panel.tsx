"use client";

import { FileText, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Bill, billPayment } from "@/lib/mock-data";
import { formatMoney, formatDate } from "@/lib/utils";

export function BillDetailPanel({
  bill,
  onClose,
}: {
  bill: Bill;
  onClose?: () => void;
}) {
  const payment = billPayment(bill);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-base font-semibold">Invoice Details</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        {/* File */}
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{bill.fileName}</div>
            <div className="text-xs text-muted-foreground">
              Uploaded on {formatDate(bill.uploadedAt)} · 10:30 AM
            </div>
          </div>
        </div>

        {/* Extracted */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Extracted Details</h3>
            <Badge tone="primary">AI Extracted</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <KV k="Vendor" v={bill.vendor} />
            <KV k="Invoice Date" v={formatDate(bill.invoiceDate)} />
            <KV k="Invoice Number" v={bill.invoiceNumber} />
            <KV k="Due Date" v={formatDate(bill.dueDate)} />
            <KV k="Amount (INR)" v={formatMoney(bill.subtotal)} />
            <KV k="GST (INR)" v={formatMoney(bill.gst)} />
            <KV k="Total Amount" v={formatMoney(bill.total)} strong />
          </dl>
          <div className="mt-3.5">
            <div className="text-xs text-muted-foreground">Description</div>
            <div className="mt-0.5 text-sm">{bill.description}</div>
          </div>
          <PanelLink label="View Full Details" />
        </section>

        <div className="border-t border-border" />

        {/* Matched payment */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Matched Payment</h3>
            {bill.matchScore !== null ? (
              <Badge tone="success">Found ({bill.matchScore}%)</Badge>
            ) : (
              <Badge tone="danger">No match</Badge>
            )}
          </div>

          {payment ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <KV k="Payment Date" v={formatDate(payment.date)} />
                <KV k="Amount" v={formatMoney(payment.amount)} />
                <KV k="From" v={`${payment.source.channel} ${payment.source.detail}`} />
                <KV k="Reference / UTR" v={payment.utr} mono />
              </dl>
              <PanelLink label="View Payment Details" />
            </>
          ) : (
            <p className="rounded-xl bg-surface-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
              No payment found yet. PayRecord will keep matching new emails.
            </p>
          )}
        </section>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-border p-5">
        <div className="mb-1 text-sm font-semibold">Actions</div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-danger/40 text-danger hover:bg-danger-soft"
            onClick={() => toast("Bill rejected")}
          >
            Reject
          </Button>
          <Button
            className="flex-1"
            onClick={() => toast.success(`${bill.invoiceNumber} approved & marked paid`)}
          >
            Approve &amp; Mark as Paid
          </Button>
        </div>
      </div>
    </div>
  );
}

function KV({
  k,
  v,
  strong,
  mono,
}: {
  k: string;
  v: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 break-all font-mono text-xs font-medium"
            : strong
              ? "mt-0.5 text-sm font-semibold"
              : "mt-0.5 text-sm font-medium"
        }
      >
        {v}
      </dd>
    </div>
  );
}

function PanelLink({ label }: { label: string }) {
  return (
    <button className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      {label} <ArrowRight className="size-4" />
    </button>
  );
}
