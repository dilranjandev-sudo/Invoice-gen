"use client";

import { Loader2, FileText, Banknote } from "lucide-react";
import { PayPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatMoney, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;

export interface Ledger {
  vendor: { name: string; gstin: string | null; email: string | null; phone: string | null };
  bills: Any[];
  payments: Any[];
  totals: { billed: number; paid: number; pending: number; billCount: number };
}

export function VendorLedger({ data }: { data: Ledger | null }) {
  if (!data) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading statement…
      </div>
    );
  }

  const m = (n: unknown) => formatMoney(Number(n) || 0, "INR");
  const { vendor, bills, payments, totals } = data;

  return (
    <div className="space-y-6">
      {/* Vendor header */}
      <div className="flex items-center gap-3">
        <Avatar name={vendor.name} className="size-11" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{vendor.name}</h2>
          <div className="truncate text-xs text-muted-foreground">
            {[vendor.gstin, vendor.email].filter(Boolean).join(" · ") || "No GSTIN / email on file"}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Total billed" value={m(totals.billed)} />
        <Tile label="Paid" value={m(totals.paid)} tone="success" />
        <Tile label="Outstanding" value={m(totals.pending)} tone={totals.pending > 0 ? "danger" : "muted"} />
      </div>

      {/* Bills */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-muted-foreground" /> Bills ({bills.length})
        </h3>
        {bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills for this vendor yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-muted/30">
                    <td className="px-3 py-2 font-medium">#{b.invoice_number || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.invoice_date ? formatDate(b.invoice_date) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{m(b.total)}</td>
                    <td className="px-3 py-2"><PayPill status={b.status || "unpaid"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payments */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Banknote className="size-4 text-muted-foreground" /> Payments ({payments.length})
        </h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded for this vendor yet.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Against</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{p.paid_on ? formatDate(p.paid_on) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.mode || p.channel || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">#{p.invoice_number || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-success">{m(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "muted";
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-bold tracking-tight", toneCls)}>{value}</div>
    </div>
  );
}
