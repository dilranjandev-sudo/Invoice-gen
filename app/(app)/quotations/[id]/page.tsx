"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>;
interface Item { name?: string; hsn?: string; qty?: number; rate?: number; gst?: number; amount?: number }

// Our own company — the "From" party on an outgoing quotation.
const COMPANY = {
  name: "Biqadx Private Limited",
  address: "One BKC, Bandra Kurla Complex, Mumbai 400051",
  email: "accounts@biqadx.com",
  phone: "+91 22 4000 1234",
  gstin: "27AAACA1234A1Z5",
  bankName: "HDFC Bank",
  bankAccount: "50200012345678",
  bankIfsc: "HDFC0001234",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-muted text-muted-foreground",
  sent: "bg-primary-soft text-primary",
  accepted: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  expired: "bg-warning-soft text-warning",
};

/* ---- number → Indian words (for "Amount in words") ------------------------ */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? ONES[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
}
function inWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let out = "";
  if (crore) out += threeDigits(crore) + " Crore ";
  if (lakh) out += twoDigits(lakh) + " Lakh ";
  if (thousand) out += twoDigits(thousand) + " Thousand ";
  if (rest) out += threeDigits(rest);
  return out.trim();
}

export default function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [q, setQ] = useState<Quote | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(attempt = 0) {
      try {
        const r = await fetch(`/api/quotations?id=${id}`);
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!r.ok) throw new Error("fetch failed");
        const j = await r.json();
        if (!cancelled) setQ(j);
      } catch {
        // Retry a few times — covers a cold-start / DB pooler hiccup.
        if (attempt < 4) setTimeout(() => load(attempt + 1), 1200 * (attempt + 1));
        else if (!cancelled) setNotFound(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-6 py-16 text-center shadow-card">
        <p className="text-sm text-muted-foreground">Quotation not found.</p>
        <Link href="/quotations" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">← Back to Quotations</Link>
      </div>
    );
  }
  if (!q) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  const cur = q.currency || "INR";
  const items: Item[] = Array.isArray(q.items) ? q.items : [];
  const subtotal = Number(q.subtotal) || 0;
  const gst = Number(q.gst) || 0;
  const total = Number(q.total) || 0;

  return (
    <div className="space-y-4 print-full">
      {/* Action bar — hidden when printing */}
      <div className="no-print flex items-center justify-between">
        <Link href="/quotations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Quotations
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/quotations?edit=${q.id}`)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Download
          </Button>
        </div>
      </div>

      {/* The document */}
      <div className="print-area mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="p-6 sm:p-10">
          {/* Header: company + meta */}
          <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl brand-gradient text-lg font-bold text-white shadow-glow">
                {COMPANY.name[0]}
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-foreground">{COMPANY.name}</div>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">{COMPANY.address}</p>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">Quotation</div>
              <div className="mt-1 text-lg font-bold gradient-text">{q.quote_number}</div>
              <p className="mt-1 text-sm text-muted-foreground">Date: <span className="text-foreground">{q.quote_date ? formatDate(q.quote_date) : "—"}</span></p>
              {q.valid_until && <p className="text-sm text-muted-foreground">Valid till: <span className="text-foreground">{formatDate(q.valid_until)}</span></p>}
            </div>
          </div>

          {/* From / To / Status */}
          <div className="grid grid-cols-1 gap-6 border-b border-border py-6 sm:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</div>
              <div className="font-semibold text-foreground">{COMPANY.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{COMPANY.address}</p>
              <p className="mt-1 text-sm text-muted-foreground">Email: <span className="text-foreground">{COMPANY.email}</span></p>
              <p className="text-sm text-muted-foreground">Phone: <span className="text-foreground">{COMPANY.phone}</span></p>
              <p className="text-sm text-muted-foreground">GSTIN: <span className="text-foreground">{COMPANY.gstin}</span></p>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">To</div>
              <div className="font-semibold text-foreground">{q.customer_name || "—"}</div>
              {q.customer_address && <p className="mt-1 text-sm text-muted-foreground">{q.customer_address}</p>}
              {q.customer_email && <p className="mt-1 text-sm text-muted-foreground">Email: <span className="text-foreground">{q.customer_email}</span></p>}
              {q.customer_gstin && <p className="text-sm text-muted-foreground">GSTIN: <span className="text-foreground">{q.customer_gstin}</span></p>}
            </div>
            <div className="sm:text-right">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
              <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize", STATUS_TONE[q.status] ?? STATUS_TONE.draft)}>{q.status}</span>
              <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{formatMoney(total, cur)}</div>
              <div className="text-xs text-muted-foreground">Total amount</div>
            </div>
          </div>

          {/* Items */}
          <div className="py-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 pr-3">#</th>
                    <th className="py-2.5 pr-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">GST</th>
                    <th className="py-2.5 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No line items.</td></tr>
                  )}
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-3 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-foreground">{it.name || "Item"}</div>
                        {it.hsn && <div className="text-xs text-muted-foreground">HSN {it.hsn}</div>}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">{it.qty ?? "—"}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">{it.rate != null ? formatMoney(Number(it.rate), cur) : "—"}</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">{it.gst != null ? `${it.gst}%` : "—"}</td>
                      <td className="py-3 pl-3 text-right font-semibold text-foreground">{it.amount != null ? formatMoney(Number(it.amount), cur) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Terms + totals */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                {q.notes && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terms &amp; Notes</div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{q.notes}</p>
                  </div>
                )}
              </div>
              <div className="sm:ml-auto sm:w-full sm:max-w-xs">
                <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatMoney(subtotal, cur)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                  <span className="text-muted-foreground">GST</span>
                  <span className="font-medium">{formatMoney(gst, cur)}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-base font-bold">{formatMoney(total, cur)}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Amount in words: <span className="font-medium text-foreground">{cur === "INR" ? "Rupees " : ""}{inWords(total)} Only</span>
            </p>
          </div>

          {/* Signature */}
          <div className="flex items-end justify-end border-t border-border pt-6 text-right">
            <div>
              <div className="ml-auto h-10 w-40 border-b border-dashed border-border-strong" />
              <div className="mt-2 text-sm font-semibold text-foreground">For {COMPANY.name}</div>
              <div className="text-xs text-muted-foreground">Authorised Signatory</div>
            </div>
          </div>

          {/* Bank details */}
          <div className="mt-6 rounded-xl border border-border bg-surface-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">Payment via bank transfer / cheque in the name of <span className="font-medium text-foreground">{COMPANY.name}</span></p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
              <span className="text-muted-foreground">Bank: <span className="text-foreground">{COMPANY.bankName}</span></span>
              <span className="text-muted-foreground">A/C: <span className="text-foreground">{COMPANY.bankAccount}</span></span>
              <span className="text-muted-foreground">IFSC: <span className="text-foreground">{COMPANY.bankIfsc}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions (hidden in print) */}
      <div className="no-print flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.push(`/quotations?edit=${q.id}`)}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button onClick={() => window.print()}>
          <Download className="size-4" /> Print / Save PDF
        </Button>
      </div>
    </div>
  );
}
