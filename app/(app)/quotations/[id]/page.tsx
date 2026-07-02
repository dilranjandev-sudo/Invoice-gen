"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Copy, Loader2, Wallet } from "lucide-react";
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

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "Draft", cls: "bg-surface-muted text-muted-foreground" },
  sent: { text: "Sent", cls: "bg-info-soft text-info" },
  accepted: { text: "Accepted", cls: "bg-success-soft text-success" },
  rejected: { text: "Rejected", cls: "bg-danger-soft text-danger" },
  expired: { text: "Expired", cls: "bg-warning-soft text-warning" },
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

function Wordmark({ size = "text-2xl" }: { size?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-md bg-primary text-white">
        <Wallet className="size-[18px]" />
      </span>
      <span className={cn("font-bold tracking-tight text-foreground", size)}>{COMPANY.name}</span>
    </span>
  );
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
      <div className="rounded-lg border border-border bg-surface px-6 py-16 text-center shadow-card">
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
  const status = STATUS_LABEL[q.status] ?? STATUS_LABEL.draft;

  return (
    <div className="space-y-4 print-full">
      {/* Action bar — hidden when printing */}
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Quotation Details</h1>
          <Link href="/quotations" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Back to Quotations
          </Link>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Download
        </Button>
      </div>

      {/* The document */}
      <div className="print-area mx-auto max-w-4xl rounded-lg border border-border bg-surface shadow-card">
        <div className="p-6 sm:p-8">
          {/* Header: company + meta */}
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Wordmark />
              <p className="mt-2 text-sm text-muted-foreground">{COMPANY.address}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-semibold text-foreground">Quotation No : <span className="text-primary">{q.quote_number}</span></p>
              <p className="mt-1">Date : <span className="text-foreground">{q.quote_date ? formatDate(q.quote_date) : "—"}</span></p>
              {q.valid_until && <p>Valid till : <span className="text-foreground">{formatDate(q.valid_until)}</span></p>}
            </div>
          </div>

          {/* From / To / Status */}
          <div className="grid grid-cols-1 gap-6 border-b border-border py-5 sm:grid-cols-3">
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">From</h5>
              <div className="font-semibold text-foreground">{COMPANY.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{COMPANY.address}</p>
              <p className="mt-1 text-sm text-muted-foreground">Email : <span className="text-foreground">{COMPANY.email}</span></p>
              <p className="text-sm text-muted-foreground">Phone : <span className="text-foreground">{COMPANY.phone}</span></p>
              <p className="text-sm text-muted-foreground">GSTIN : <span className="text-foreground">{COMPANY.gstin}</span></p>
            </div>
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">To</h5>
              <div className="font-semibold text-foreground">{q.customer_name || "—"}</div>
              {q.customer_address && <p className="mt-1 text-sm text-muted-foreground">{q.customer_address}</p>}
              {q.customer_email && <p className="mt-1 text-sm text-muted-foreground">Email : <span className="text-foreground">{q.customer_email}</span></p>}
              {q.customer_gstin && <p className="text-sm text-muted-foreground">GSTIN : <span className="text-foreground">{q.customer_gstin}</span></p>}
            </div>
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">Status</h5>
              <span className={cn("mb-2 inline-block rounded-md px-2.5 py-1 text-xs font-semibold", status.cls)}>{status.text}</span>
              <div className="mt-2 text-xl font-bold text-foreground">{formatMoney(total, cur)}</div>
              <div className="text-xs text-muted-foreground">Total amount</div>
            </div>
          </div>

          {/* Quotation for */}
          {items[0]?.name && (
            <p className="py-4 text-sm text-muted-foreground">
              Quotation For : <span className="font-medium text-foreground">{items.map((i) => i.name).filter(Boolean).slice(0, 2).join(", ")}{items.length > 2 ? " …" : ""}</span>
            </p>
          )}

          {/* Items — bordered table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-muted text-left text-foreground">
                  <th className="border border-border px-3 py-2.5 font-semibold">Description</th>
                  <th className="border border-border px-3 py-2.5 text-right font-semibold">Qty</th>
                  <th className="border border-border px-3 py-2.5 text-right font-semibold">Rate</th>
                  <th className="border border-border px-3 py-2.5 text-right font-semibold">GST</th>
                  <th className="border border-border px-3 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={5} className="border border-border px-3 py-8 text-center text-muted-foreground">No line items.</td></tr>
                )}
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="border border-border px-3 py-2.5">
                      <div className="font-medium text-foreground">{it.name || "Item"}</div>
                      {it.hsn && <div className="text-xs text-muted-foreground">HSN {it.hsn}</div>}
                    </td>
                    <td className="border border-border px-3 py-2.5 text-right text-muted-foreground">{it.qty ?? "—"}</td>
                    <td className="border border-border px-3 py-2.5 text-right text-muted-foreground">{it.rate != null ? formatMoney(Number(it.rate), cur) : "—"}</td>
                    <td className="border border-border px-3 py-2.5 text-right text-muted-foreground">{it.gst != null ? `${it.gst}%` : "—"}</td>
                    <td className="border border-border px-3 py-2.5 text-right font-semibold text-foreground">{it.amount != null ? formatMoney(Number(it.amount), cur) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Terms + totals */}
          <div className="grid grid-cols-1 gap-6 border-b border-border py-6 sm:grid-cols-2">
            <div className="space-y-4">
              {q.notes && (
                <div>
                  <h6 className="mb-1 text-sm font-semibold text-foreground">Terms and Conditions</h6>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{q.notes}</p>
                </div>
              )}
              <div>
                <h6 className="mb-1 text-sm font-semibold text-foreground">Notes</h6>
                <p className="text-sm text-muted-foreground">Please quote the quotation number when responding.</p>
              </div>
            </div>
            <div className="sm:ml-auto sm:w-full sm:max-w-xs">
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="font-medium text-foreground">Sub Total</span>
                <span className="font-medium text-foreground">{formatMoney(subtotal, cur)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="font-medium text-foreground">GST</span>
                <span className="font-medium text-foreground">{formatMoney(gst, cur)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-base font-bold text-foreground">Total Amount</span>
                <span className="text-base font-bold text-foreground">{formatMoney(total, cur)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Amount in words : <span className="font-medium text-foreground">{cur === "INR" ? "Rupees " : ""}{inWords(total)} Only</span>
              </p>
            </div>
          </div>

          {/* Signature */}
          <div className="flex items-end justify-end border-b border-border py-6 text-right">
            <div>
              <div className="ml-auto h-10 w-44 border-b border-dashed border-border-strong" />
              <div className="mt-2 text-sm font-semibold text-foreground">For {COMPANY.name}</div>
              <div className="text-xs text-muted-foreground">Authorised Signatory</div>
            </div>
          </div>

          {/* Bank details — centered */}
          <div className="border-b border-border py-6 text-center">
            <div className="mb-3 flex justify-center"><Wordmark size="text-lg" /></div>
            <p className="text-sm text-muted-foreground">Payment made via bank transfer / cheque in the name of <span className="font-medium text-foreground">{COMPANY.name}</span></p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
              <span className="text-muted-foreground">Bank Name : <span className="text-foreground">{COMPANY.bankName}</span></span>
              <span className="text-muted-foreground">Account Number : <span className="text-foreground">{COMPANY.bankAccount}</span></span>
              <span className="text-muted-foreground">IFSC : <span className="text-foreground">{COMPANY.bankIfsc}</span></span>
            </div>
          </div>

          {/* Buttons */}
          <div className="no-print flex items-center justify-end gap-2 pt-5">
            <Button variant="outline" onClick={() => router.push(`/quotations?edit=${q.id}`)}>
              <Copy className="size-4" /> Clone / Edit
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print Quotation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
