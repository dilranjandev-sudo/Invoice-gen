"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, Loader2, Wallet, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PO = Record<string, any>;
interface Item { name?: string; hsn?: string; qty?: number; rate?: number; gst?: number; amount?: number }

const COMPANY = {
  name: "Biqadx Private Limited",
  address: "One BKC, Bandra Kurla Complex, Mumbai 400051",
  email: "accounts@biqadx.com",
  phone: "+91 22 4000 1234",
  gstin: "27AAACA1234A1Z5",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "Draft", cls: "bg-surface-muted text-muted-foreground" },
  sent: { text: "Sent", cls: "bg-info-soft text-info" },
  received: { text: "Received", cls: "bg-success-soft text-success" },
  closed: { text: "Closed", cls: "bg-surface-muted text-muted-foreground" },
};

function Wordmark({ size = "text-2xl" }: { size?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-md bg-primary text-white"><Wallet className="size-[18px]" /></span>
      <span className={cn("font-bold tracking-tight text-foreground", size)}>{COMPANY.name}</span>
    </span>
  );
}

export default function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [po, setPo] = useState<PO | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function fetchPo() {
    const r = await fetch(`/api/purchase-orders?id=${id}`);
    if (r.status === 404) { setNotFound(true); return; }
    if (!r.ok) throw new Error("fetch failed");
    setPo(await r.json());
  }
  useEffect(() => {
    let cancelled = false;
    async function load(attempt = 0) {
      try {
        const r = await fetch(`/api/purchase-orders?id=${id}`);
        if (r.status === 404) { if (!cancelled) setNotFound(true); return; }
        if (!r.ok) throw new Error("fetch failed");
        const j = await r.json();
        if (!cancelled) setPo(j);
      } catch {
        if (attempt < 4) setTimeout(() => load(attempt + 1), 1200 * (attempt + 1));
        else if (!cancelled) setNotFound(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function markReceived() {
    await fetch("/api/purchase-orders", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "status", status: "received" }) });
    toast.success("Marked as received");
    fetchPo().catch(() => {});
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-border bg-surface px-6 py-16 text-center shadow-card">
        <p className="text-sm text-muted-foreground">Purchase order not found.</p>
        <Link href="/purchasing" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">← Back to Purchase Orders</Link>
      </div>
    );
  }
  if (!po) {
    return <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>;
  }

  const cur = po.currency || "INR";
  const items: Item[] = Array.isArray(po.items) ? po.items : [];
  const subtotal = Number(po.subtotal) || 0;
  const gst = Number(po.gst) || 0;
  const total = Number(po.total) || 0;
  const status = STATUS_LABEL[po.status] ?? STATUS_LABEL.draft;

  return (
    <div className="space-y-4 print-full">
      <div className="no-print flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Purchase Order</h1>
          <Link href="/purchasing" className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" /> Back to Purchase Orders
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {po.status !== "received" && (
            <Button variant="outline" onClick={markReceived}><PackageCheck className="size-4" /> Mark received</Button>
          )}
          <Button onClick={() => window.print()}><Printer className="size-4" /> Download</Button>
        </div>
      </div>

      <div className="print-area mx-auto max-w-4xl rounded-lg border border-border bg-surface shadow-card">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Wordmark />
              <p className="mt-2 text-sm text-muted-foreground">{COMPANY.address}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="font-semibold text-foreground">PO No : <span className="text-primary">{po.po_number}</span></p>
              <p className="mt-1">Order date : <span className="text-foreground">{po.order_date ? formatDate(po.order_date) : "—"}</span></p>
              {po.expected_date && <p>Expected by : <span className="text-foreground">{formatDate(po.expected_date)}</span></p>}
            </div>
          </div>

          {/* Buyer / Vendor / Status */}
          <div className="grid grid-cols-1 gap-6 border-b border-border py-5 sm:grid-cols-3">
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">Buyer</h5>
              <div className="font-semibold text-foreground">{COMPANY.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{COMPANY.address}</p>
              <p className="mt-1 text-sm text-muted-foreground">Email : <span className="text-foreground">{COMPANY.email}</span></p>
              <p className="text-sm text-muted-foreground">GSTIN : <span className="text-foreground">{COMPANY.gstin}</span></p>
            </div>
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">Vendor</h5>
              <div className="font-semibold text-foreground">{po.vendor_name || "—"}</div>
              {po.vendor_address && <p className="mt-1 text-sm text-muted-foreground">{po.vendor_address}</p>}
              {po.vendor_email && <p className="mt-1 text-sm text-muted-foreground">Email : <span className="text-foreground">{po.vendor_email}</span></p>}
              {po.vendor_gstin && <p className="text-sm text-muted-foreground">GSTIN : <span className="text-foreground">{po.vendor_gstin}</span></p>}
            </div>
            <div>
              <h5 className="mb-2 text-sm font-medium text-foreground">Status</h5>
              <span className={cn("mb-2 inline-block rounded-md px-2.5 py-1 text-xs font-semibold", status.cls)}>{status.text}</span>
              <div className="mt-2 text-xl font-bold text-foreground">{formatMoney(total, cur)}</div>
              <div className="text-xs text-muted-foreground">Order total</div>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto py-6">
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
                {items.length === 0 && <tr><td colSpan={5} className="border border-border px-3 py-8 text-center text-muted-foreground">No line items.</td></tr>}
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

          {/* Notes + totals */}
          <div className="grid grid-cols-1 gap-6 border-b border-border pb-6 sm:grid-cols-2">
            <div>
              {po.notes && (
                <>
                  <h6 className="mb-1 text-sm font-semibold text-foreground">Terms &amp; Notes</h6>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{po.notes}</p>
                </>
              )}
            </div>
            <div className="sm:ml-auto sm:w-full sm:max-w-xs">
              <div className="flex items-center justify-between border-b border-border py-2 text-sm"><span className="font-medium text-foreground">Sub Total</span><span className="font-medium text-foreground">{formatMoney(subtotal, cur)}</span></div>
              <div className="flex items-center justify-between border-b border-border py-2 text-sm"><span className="font-medium text-foreground">GST</span><span className="font-medium text-foreground">{formatMoney(gst, cur)}</span></div>
              <div className="flex items-center justify-between py-3"><span className="text-base font-bold text-foreground">Total</span><span className="text-base font-bold text-foreground">{formatMoney(total, cur)}</span></div>
            </div>
          </div>

          {/* Signature */}
          <div className="flex items-end justify-end pt-6 text-right">
            <div>
              <div className="ml-auto h-10 w-44 border-b border-dashed border-border-strong" />
              <div className="mt-2 text-sm font-semibold text-foreground">For {COMPANY.name}</div>
              <div className="text-xs text-muted-foreground">Authorised Signatory</div>
            </div>
          </div>

          <div className="no-print flex items-center justify-end gap-2 pt-6">
            <Button variant="outline" onClick={() => router.push(`/purchasing?edit=${po.id}`)}><Pencil className="size-4" /> Edit</Button>
            <Button onClick={() => window.print()}><Printer className="size-4" /> Print PO</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
