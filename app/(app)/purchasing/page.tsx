"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Send, Trash2, Pencil, Eye, Mail, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Item { name: string; hsn: string; qty: string; rate: string; gst: string; amount: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PO = Record<string, any>;

const emptyItem = (): Item => ({ name: "", hsn: "", qty: "1", rate: "", gst: "18", amount: "" });
const EMPTY = {
  vendorName: "", vendorEmail: "", vendorGstin: "", vendorAddress: "",
  orderDate: new Date().toISOString().slice(0, 10), expectedDate: "", notes: "",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-muted text-muted-foreground",
  sent: "bg-info-soft text-info",
  received: "bg-success-soft text-success",
  closed: "bg-surface-muted text-muted-foreground",
};

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PO[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vendors, setVendors] = useState<any[]>([]);

  async function load() {
    try {
      const r = await fetch("/api/purchase-orders");
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
    fetch("/api/vendors").then((r) => r.json()).then((j) => setVendors(Array.isArray(j) ? j : [])).catch(() => {});
  }, []);

  function pickVendor(id: string) {
    const v = vendors.find((x) => x.id === id);
    if (!v) return;
    setForm((f) => ({
      ...f,
      vendorName: v.name ?? "",
      vendorEmail: v.email ?? "",
      vendorGstin: v.gstin ?? "",
      vendorAddress: v.address ?? "",
    }));
  }

  useEffect(() => {
    if (!rows) return;
    const editParam = new URLSearchParams(window.location.search).get("edit");
    if (editParam) {
      const po = rows.find((r) => r.id === editParam);
      if (po) openEdit(po);
      window.history.replaceState(null, "", "/purchasing");
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
  function openEdit(po: PO) {
    setEditId(po.id);
    setForm({
      vendorName: po.vendor_name ?? "", vendorEmail: po.vendor_email ?? "",
      vendorGstin: po.vendor_gstin ?? "", vendorAddress: po.vendor_address ?? "",
      orderDate: po.order_date ? String(po.order_date).slice(0, 10) : "",
      expectedDate: po.expected_date ? String(po.expected_date).slice(0, 10) : "", notes: po.notes ?? "",
    });
    setItems(
      Array.isArray(po.items) && po.items.length
        ? po.items.map((it: Item) => ({ name: it.name ?? "", hsn: it.hsn ?? "", qty: String(it.qty ?? ""), rate: String(it.rate ?? ""), gst: String(it.gst ?? ""), amount: String(it.amount ?? "") }))
        : [emptyItem()]
    );
    setOpen(true);
  }

  async function save() {
    if (!form.vendorName.trim()) return toast.error("Vendor name is required.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: items.filter((it) => it.name.trim() || it.amount).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty) || null, rate: Number(it.rate) || null, gst: Number(it.gst) || null, amount: Number(it.amount) || null })),
      };
      const r = await fetch("/api/purchase-orders", {
        method: editId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success(editId ? "Purchase order updated" : "Purchase order created");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendPo(po: PO) {
    if (!po.vendor_email) return toast.error("Add a vendor email first (edit the PO).");
    setSending(po.id);
    try {
      const r = await fetch("/api/purchase-orders/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: po.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Send failed");
      toast.success(`Purchase order emailed to ${po.vendor_email}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/purchase-orders", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "status", status }) });
    toast.success(status === "received" ? "Marked as received" : "Updated");
    load();
  }

  async function del(id: string) {
    toast("Delete this purchase order?", {
      action: { label: "Delete", onClick: async () => { await fetch("/api/purchase-orders", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); toast.success("Deleted"); load(); } },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        description="Order goods from a vendor — send the PO, then receive the bill against it."
        actions={<Button onClick={openNew}><Plus className="size-4" /> New PO</Button>}
      />

      {rows === null ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-5 py-3.5">PO #</th>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Order date</th>
                  <th className="px-5 py-3.5">Expected</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-muted-foreground">No purchase orders yet — click <span className="font-medium text-foreground">New PO</span>.</td></tr>}
                {rows.map((po) => (
                  <tr key={po.id} className="hover:bg-surface-muted/30">
                    <td className="px-5 py-3.5 font-medium text-primary">{po.po_number}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{po.vendor_name || "—"}</div>
                      {po.vendor_email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" /> {po.vendor_email}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{po.order_date ? formatDate(po.order_date) : "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{po.expected_date ? formatDate(po.expected_date) : "—"}</td>
                    <td className="px-5 py-3.5 text-right font-medium">{formatMoney(Number(po.total) || 0, po.currency || "INR")}</td>
                    <td className="px-5 py-3.5"><span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_TONE[po.status] ?? STATUS_TONE.draft)}>{po.status}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/purchasing/${po.id}`} title="View / Print" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-primary-soft hover:text-primary"><Eye className="size-4" /></Link>
                        {po.status !== "received" && (
                          <button onClick={() => setStatus(po.id, "received")} title="Mark received" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-success-soft hover:text-success"><PackageCheck className="size-4" /></button>
                        )}
                        <button onClick={() => sendPo(po)} disabled={sending === po.id} title="Send to vendor" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-primary-soft hover:text-primary disabled:opacity-50">
                          {sending === po.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        </button>
                        <button onClick={() => openEdit(po)} title="Edit" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted"><Pencil className="size-4" /></button>
                        <button onClick={() => del(po.id)} title="Delete" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit Purchase Order" : "New Purchase Order"}
        width="max-w-3xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save changes" : "Create"}</Button></>}
      >
        <div className="space-y-5">
          {vendors.length > 0 && (
            <Field label="Pick an existing vendor" hint="Auto-fills the details below — or just type a new one">
              <Select defaultValue="" onChange={(e) => pickVendor(e.target.value)}>
                <option value="">— New vendor —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vendor name"><Input value={form.vendorName} onChange={(e) => upd("vendorName", e.target.value)} placeholder="Acme Supplies" /></Field>
            <Field label="Vendor email"><Input type="email" value={form.vendorEmail} onChange={(e) => upd("vendorEmail", e.target.value)} placeholder="sales@acme.com" /></Field>
            <Field label="GSTIN"><Input value={form.vendorGstin} onChange={(e) => upd("vendorGstin", e.target.value)} /></Field>
            <Field label="Address"><Input value={form.vendorAddress} onChange={(e) => upd("vendorAddress", e.target.value)} /></Field>
            <Field label="Order date"><Input type="date" value={form.orderDate} onChange={(e) => upd("orderDate", e.target.value)} /></Field>
            <Field label="Expected by"><Input type="date" value={form.expectedDate} onChange={(e) => upd("expectedDate", e.target.value)} /></Field>
          </div>

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

          <Field label="Notes / terms"><textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={3} placeholder="Delivery terms, payment terms, etc." className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></Field>
        </div>
      </Drawer>
    </div>
  );
}
