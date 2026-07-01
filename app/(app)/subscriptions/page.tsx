"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Pencil, Trash2, CalendarClock, Repeat, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sub = Record<string, any>;

const EMPTY = {
  name: "", provider: "", purchasedFrom: "", category: "Hosting",
  purchaseDate: "", renewalDate: "", price: "", cycle: "yearly", notes: "", status: "active",
};
const CATS = ["Hosting", "Domain", "Email / Workspace", "Software / SaaS", "Cloud", "Other"];

function daysTo(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((d - t0) / 86400000);
}

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/subscriptions");
      setRows(await r.json());
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setEditId(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(s: Sub) {
    setEditId(s.id);
    setForm({
      name: s.name ?? "", provider: s.provider ?? "", purchasedFrom: s.purchased_from ?? "",
      category: s.category ?? "Other", purchaseDate: s.purchase_date ? String(s.purchase_date).slice(0, 10) : "",
      renewalDate: s.renewal_date ? String(s.renewal_date).slice(0, 10) : "", price: s.price != null ? String(s.price) : "",
      cycle: s.cycle ?? "yearly", notes: s.notes ?? "", status: s.status ?? "active",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      const r = await fetch("/api/subscriptions", {
        method: editId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...form } : form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success(editId ? "Updated" : "Added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }
  function del(id: string) {
    toast("Delete this?", {
      action: { label: "Delete", onClick: async () => { await fetch("/api/subscriptions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); load(); } },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  const active = (rows ?? []).filter((s) => s.status !== "cancelled");
  const yearlyCost = active.reduce((sum, s) => {
    const p = Number(s.price) || 0;
    return sum + (s.cycle === "monthly" ? p * 12 : s.cycle === "one-time" ? 0 : p);
  }, 0);
  const dueSoon = active.filter((s) => { const d = daysTo(s.renewal_date); return d != null && d <= 30; });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions & Renewals"
        description="Track what you pay for — hosting, domains, workspace, SaaS — and never miss a renewal."
        actions={<Button onClick={openNew}><Plus className="size-4" /> Add subscription</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary"><Repeat className="size-5" /></div>
          <div><div className="text-xs text-muted-foreground">Active</div><div className="text-lg font-bold">{active.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-md bg-surface-muted text-muted-foreground"><CalendarClock className="size-5" /></div>
          <div><div className="text-xs text-muted-foreground">Yearly cost (est.)</div><div className="text-lg font-bold">{formatMoney(yearlyCost)}</div></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-md bg-warning-soft text-warning"><AlertTriangle className="size-5" /></div>
          <div><div className="text-xs text-muted-foreground">Renewing ≤ 30 days</div><div className="text-lg font-bold">{dueSoon.length}</div></div>
        </Card>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-3.5">Service</th>
                <th className="px-5 py-3.5">Bought from</th>
                <th className="px-5 py-3.5">Purchased</th>
                <th className="px-5 py-3.5">Renews</th>
                <th className="px-5 py-3.5 text-right">Price</th>
                <th className="px-5 py-3.5">Cycle</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null && <tr><td colSpan={7} className="px-5 py-12 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-muted-foreground">Nothing yet — add Hostinger, Google Workspace, your domain, etc.</td></tr>}
              {rows?.map((s) => {
                const d = daysTo(s.renewal_date);
                const tone = d == null ? "" : d < 0 ? "text-danger" : d <= 30 ? "text-warning" : "text-muted-foreground";
                return (
                  <tr key={s.id} className={cn("hover:bg-surface-muted/30", s.status === "cancelled" && "opacity-50")}>
                    <td className="px-5 py-3.5"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.category}{s.provider ? ` · ${s.provider}` : ""}</div></td>
                    <td className="px-5 py-3.5 text-muted-foreground">{s.purchased_from || "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{s.purchase_date ? formatDate(s.purchase_date) : "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn("font-medium", tone)}>{s.renewal_date ? formatDate(s.renewal_date) : "—"}</span>
                      {d != null && <span className={cn("ml-1.5 text-xs", tone)}>{d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `in ${d}d`}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">{s.price != null ? formatMoney(Number(s.price), s.currency || "INR") : "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground capitalize">{s.cycle || "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} title="Edit" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted"><Pencil className="size-4" /></button>
                        <button onClick={() => del(s.id)} title="Delete" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title={editId ? "Edit subscription" : "Add subscription"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save" : "Add"}</Button></>}>
        <div className="space-y-4">
          <Field label="Service name"><Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Hostinger Business Hosting" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category"><Select value={form.category} onChange={(e) => upd("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Provider"><Input value={form.provider} onChange={(e) => upd("provider", e.target.value)} placeholder="Hostinger" /></Field>
          </div>
          <Field label="Bought from (where)" hint="Website / reseller / account"><Input value={form.purchasedFrom} onChange={(e) => upd("purchasedFrom", e.target.value)} placeholder="hostinger.com" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase date"><Input type="date" value={form.purchaseDate} onChange={(e) => upd("purchaseDate", e.target.value)} /></Field>
            <Field label="Renewal date"><Input type="date" value={form.renewalDate} onChange={(e) => upd("renewalDate", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price"><Input type="number" value={form.price} onChange={(e) => upd("price", e.target.value)} placeholder="0" /></Field>
            <Field label="Billing cycle"><Select value={form.cycle} onChange={(e) => upd("cycle", e.target.value)}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="one-time">One-time</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status"><Select value={form.status} onChange={(e) => upd("status", e.target.value)}><option value="active">Active</option><option value="cancelled">Cancelled</option></Select></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => upd("notes", e.target.value)} placeholder="Login email, plan, etc." /></Field>
        </div>
      </Drawer>
    </div>
  );
}
