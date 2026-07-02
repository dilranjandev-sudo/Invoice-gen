"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, Repeat, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { EXPENSE_CATEGORIES } from "@/lib/expense";
import { formatMoney, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const FREQ = ["monthly", "quarterly", "yearly", "weekly"];
const EMPTY = { name: "", payee: "", category: "Rent", amount: "", frequency: "monthly", nextDue: "", notes: "" };

function dueInfo(nextDue: string | null): { days: number | null; tone: string; label: string } {
  if (!nextDue) return { days: null, tone: "bg-surface-muted text-muted-foreground", label: "No date" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(String(nextDue).slice(0, 10) + "T00:00:00");
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { days, tone: "bg-danger-soft text-danger", label: `Overdue ${Math.abs(days)}d` };
  if (days === 0) return { days, tone: "bg-danger-soft text-danger", label: "Due today" };
  if (days <= 7) return { days, tone: "bg-warning-soft text-warning", label: `Due in ${days}d` };
  return { days, tone: "bg-success-soft text-success", label: `In ${days}d` };
}

export default function RecurringPage() {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/recurring");
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => { load(); }, []);

  function upd(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openNew() { setEditId(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: Rec) {
    setEditId(r.id);
    setForm({
      name: r.name ?? "", payee: r.payee ?? "", category: r.category ?? "Rent",
      amount: r.amount != null ? String(r.amount) : "", frequency: r.frequency ?? "monthly",
      nextDue: r.next_due ? String(r.next_due).slice(0, 10) : "", notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      const r = await fetch("/api/recurring", {
        method: editId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...form } : form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success(editId ? "Updated" : "Recurring expense added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(r: Rec) {
    const res = await fetch("/api/recurring", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, action: "paid" }) });
    const j = await res.json();
    if (res.ok) toast.success(`Marked paid — next due ${j.next_due ? formatDate(j.next_due) : ""}`);
    load();
  }

  async function del(id: string) {
    toast("Delete this recurring expense?", {
      action: { label: "Delete", onClick: async () => { await fetch("/api/recurring", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); toast.success("Deleted"); load(); } },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  const all = rows ?? [];
  const active = all.filter((r) => r.active);
  const dueSoon = active.filter((r) => { const i = dueInfo(r.next_due); return i.days != null && i.days >= 0 && i.days <= 7; }).length;
  const overdue = active.filter((r) => { const i = dueInfo(r.next_due); return i.days != null && i.days < 0; }).length;
  const monthlyEq = active.reduce((s, r) => {
    const a = Number(r.amount) || 0;
    const f = r.frequency;
    return s + (f === "yearly" ? a / 12 : f === "quarterly" ? a / 3 : f === "weekly" ? a * 4.33 : a);
  }, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recurring"
        description="Rent, subscriptions & services you pay on a schedule — with renewal reminders."
        actions={<Button onClick={openNew}><Plus className="size-4" /> Add recurring</Button>}
      />

      {rows === null ? (
        <><StatCardsSkeleton count={3} /><TableSkeleton rows={5} /></>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3.5 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><Repeat className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">Est. monthly</div><div className="text-lg font-semibold">{formatMoney(monthlyEq)}</div><div className="text-xs text-muted-foreground">{active.length} active</div></div>
            </Card>
            <Card className="flex items-center gap-3.5 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-warning-soft text-warning"><Clock className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">Due this week</div><div className="text-lg font-semibold">{dueSoon}</div><div className="text-xs text-muted-foreground">next 7 days</div></div>
            </Card>
            <Card className="flex items-center gap-3.5 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-danger-soft text-danger"><AlertTriangle className="size-5" /></div>
              <div><div className="text-xs text-muted-foreground">Overdue</div><div className="text-lg font-semibold">{overdue}</div><div className="text-xs text-muted-foreground">need paying</div></div>
            </Card>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Cycle</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5">Next due</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {all.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-muted-foreground">Nothing recurring yet — add rent, Google Workspace, Hostinger…</td></tr>}
                  {all.map((r) => {
                    const info = dueInfo(r.next_due);
                    return (
                      <tr key={r.id} className={cn("hover:bg-surface-muted/30", !r.active && "opacity-50")}>
                        <td className="px-5 py-3.5">
                          <div className="font-medium">{r.name}</div>
                          {r.payee && <div className="text-xs text-muted-foreground">{r.payee}</div>}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{r.category || "—"}</td>
                        <td className="px-5 py-3.5 capitalize text-muted-foreground">{r.frequency}</td>
                        <td className="px-5 py-3.5 text-right font-medium">{r.amount != null ? formatMoney(Number(r.amount), r.currency || "INR") : "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{r.next_due ? formatDate(r.next_due) : "—"}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", info.tone)}>{info.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => markPaid(r)} title="Mark paid (roll to next cycle)" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-success-soft hover:text-success"><Check className="size-4" /></button>
                            <button onClick={() => openEdit(r)} title="Edit" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted"><Pencil className="size-4" /></button>
                            <button onClick={() => del(r.id)} title="Delete" className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit recurring expense" : "Add recurring expense"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? "Saving…" : editId ? "Save changes" : "Add"}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Office Rent / Google Workspace" /></Field>
          <Field label="Paid to (optional)"><Input value={form.payee} onChange={(e) => upd("payee", e.target.value)} placeholder="Landlord / Google" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category"><Select value={form.category} onChange={(e) => upd("category", e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => upd("amount", e.target.value)} placeholder="50000" /></Field>
            <Field label="Cycle"><Select value={form.frequency} onChange={(e) => upd("frequency", e.target.value)}>{FREQ.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}</Select></Field>
            <Field label="Next due date"><Input type="date" value={form.nextDue} onChange={(e) => upd("nextDue", e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => upd("notes", e.target.value)} placeholder="Optional" /></Field>
          <p className="text-xs text-muted-foreground">Tip: hit <Check className="inline size-3" /> when you pay — the next due date rolls forward automatically.</p>
        </div>
      </Drawer>
    </div>
  );
}
