"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Send, Trash2, Pencil, FileText, Mail, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Item { name: string; hsn: string; qty: string; rate: string; gst: string; amount: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>;

const emptyItem = (): Item => ({ name: "", hsn: "", qty: "1", rate: "", gst: "18", amount: "" });
const EMPTY = {
  customerName: "", customerEmail: "", customerGstin: "", customerAddress: "",
  quoteDate: new Date().toISOString().slice(0, 10), validUntil: "", notes: "",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-muted text-muted-foreground",
  sent: "bg-primary-soft text-primary",
  accepted: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  expired: "bg-warning-soft text-warning",
};

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quote[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/quotations");
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // If we arrived from the detail page with ?edit=<id>, open that quote for editing.
  useEffect(() => {
    if (!rows) return;
    const editParam = new URLSearchParams(window.location.search).get("edit");
    if (editParam) {
      const q = rows.find((r) => r.id === editParam);
      if (q) openEdit(q);
      window.history.replaceState(null, "", "/quotations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function upd(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function updItem(i: number, k: keyof Item, v: string) {
    setItems((its) => {
      const next = its.map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
      if (k === "qty" || k === "rate") {
        const q = Number(next[i].qty) || 0;
        const r = Number(next[i].rate) || 0;
        next[i].amount = q && r ? String(q * r) : next[i].amount;
      }
      return next;
    });
  }

  const sub = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const gst = items.reduce((s, it) => s + (Number(it.amount) || 0) * ((Number(it.gst) || 0) / 100), 0);
  const total = sub + gst;

  function openNew() {
    setEditId(null);
    setForm(EMPTY);
    setItems([emptyItem()]);
    setOpen(true);
  }
  function openEdit(q: Quote) {
    setEditId(q.id);
    setForm({
      customerName: q.customer_name ?? "", customerEmail: q.customer_email ?? "",
      customerGstin: q.customer_gstin ?? "", customerAddress: q.customer_address ?? "",
      quoteDate: q.quote_date ? String(q.quote_date).slice(0, 10) : "",
      validUntil: q.valid_until ? String(q.valid_until).slice(0, 10) : "", notes: q.notes ?? "",
    });
    setItems(
      Array.isArray(q.items) && q.items.length
        ? q.items.map((it: Item) => ({ name: it.name ?? "", hsn: it.hsn ?? "", qty: String(it.qty ?? ""), rate: String(it.rate ?? ""), gst: String(it.gst ?? ""), amount: String(it.amount ?? "") }))
        : [emptyItem()]
    );
    setOpen(true);
  }

  async function save() {
    if (!form.customerName.trim()) return toast.error("Customer name is required.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: items.filter((it) => it.name.trim() || it.amount).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty) || null, rate: Number(it.rate) || null, gst: Number(it.gst) || null, amount: Number(it.amount) || null })),
      };
      const r = await fetch("/api/quotations", {
        method: editId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success(editId ? "Quotation updated" : "Quotation created");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote(q: Quote) {
    if (!q.customer_email) return toast.error("Add a customer email first (edit the quote).");
    setSending(q.id);
    try {
      const r = await fetch("/api/quotations/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: q.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Send failed");
      toast.success(`Quotation emailed to ${q.customer_email}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  async function del(id: string) {
    toast("Delete this quotation?", {
      action: { label: "Delete", onClick: async () => { await fetch("/api/quotations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); toast.success("Deleted"); load(); } },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        description="Create a quotation and email it to your customer — with your logo and totals."
        actions={<Button onClick={openNew}><Plus className="size-4" /> New Quotation</Button>}
      />

      {rows === null ? (
        <TableSkeleton rows={6} />
      ) : (
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-3.5">Quote #</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Valid till</th>
                <th className="px-5 py-3.5 text-right">Total</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows && rows.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-muted-foreground">No quotations yet — click <span className="font-medium text-foreground">New Quotation</span>.</td></tr>}
              {rows?.map((q) => (
                <tr key={q.id} className="hover:bg-surface-muted/30">
                  <td className="px-5 py-3.5 font-medium text-primary">{q.quote_number}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium">{q.customer_name || "—"}</div>
                    {q.customer_email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" /> {q.customer_email}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{q.quote_date ? formatDate(q.quote_date) : "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{q.valid_until ? formatDate(q.valid_until) : "—"}</td>
                  <td className="px-5 py-3.5 text-right font-medium">{formatMoney(Number(q.total) || 0, q.currency || "INR")}</td>
                  <td className="px-5 py-3.5"><span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_TONE[q.status] ?? STATUS_TONE.draft)}>{q.status}</span></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/quotations/${q.id}`} title="View / Print" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-primary-soft hover:text-primary">
                        <Eye className="size-4" />
                      </Link>
                      <button onClick={() => sendQuote(q)} disabled={sending === q.id} title="Send email" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-primary-soft hover:text-primary disabled:opacity-50">
                        {sending === q.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </button>
                      <button onClick={() => openEdit(q)} title="Edit" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted"><Pencil className="size-4" /></button>
                      <button onClick={() => del(q.id)} title="Delete" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Create / edit */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit Quotation" : "New Quotation"}
        width="max-w-3xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save changes" : "Create"}</Button></>}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer name"><Input value={form.customerName} onChange={(e) => upd("customerName", e.target.value)} placeholder="Acme Ltd." /></Field>
            <Field label="Customer email"><Input type="email" value={form.customerEmail} onChange={(e) => upd("customerEmail", e.target.value)} placeholder="buyer@acme.com" /></Field>
            <Field label="GSTIN"><Input value={form.customerGstin} onChange={(e) => upd("customerGstin", e.target.value)} /></Field>
            <Field label="Address"><Input value={form.customerAddress} onChange={(e) => upd("customerAddress", e.target.value)} /></Field>
            <Field label="Quote date"><Input type="date" value={form.quoteDate} onChange={(e) => upd("quoteDate", e.target.value)} /></Field>
            <Field label="Valid until"><Input type="date" value={form.validUntil} onChange={(e) => upd("validUntil", e.target.value)} /></Field>
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Items</span>
              <button onClick={() => setItems((it) => [...it, emptyItem()])} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="size-3.5" /> Add item</button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-[2fr_1fr_1fr_0.8fr_1fr_auto]">
                  <input value={it.name} onChange={(e) => updItem(i, "name", e.target.value)} placeholder="Description" className="h-8 rounded border border-border-strong bg-surface px-2 text-sm" />
                  <input value={it.qty} onChange={(e) => updItem(i, "qty", e.target.value)} placeholder="Qty" type="number" className="hidden h-8 rounded border border-border-strong bg-surface px-2 text-right text-sm sm:block" />
                  <input value={it.rate} onChange={(e) => updItem(i, "rate", e.target.value)} placeholder="Rate" type="number" className="hidden h-8 rounded border border-border-strong bg-surface px-2 text-right text-sm sm:block" />
                  <input value={it.gst} onChange={(e) => updItem(i, "gst", e.target.value)} placeholder="GST%" type="number" className="hidden h-8 rounded border border-border-strong bg-surface px-2 text-right text-sm sm:block" />
                  <input value={it.amount} onChange={(e) => updItem(i, "amount", e.target.value)} placeholder="Amount" type="number" className="h-8 rounded border border-border-strong bg-surface px-2 text-right text-sm" />
                  <button onClick={() => setItems((its) => its.filter((_, idx) => idx !== i))} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 ml-auto max-w-[220px] space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMoney(sub)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>GST</span><span>{formatMoney(gst)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{formatMoney(total)}</span></div>
            </div>
          </div>

          <Field label="Notes / terms"><textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={3} placeholder="Payment terms, delivery, etc." className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></Field>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="size-3.5" /> Saved as a draft. Use <Send className="size-3" /> Send from the list to email it.</p>
        </div>
      </Drawer>
    </div>
  );
}
