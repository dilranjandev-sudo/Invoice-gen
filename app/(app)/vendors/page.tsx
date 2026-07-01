"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ArrowUpDown,
  Star,
  Mail,
  Phone,
  MessageSquare,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field } from "@/components/ui/input";
import { RowMenu } from "@/components/ui/row-menu";
import { PageHeader } from "@/components/layout/page-header";
import { VendorLedger, type Ledger } from "@/components/vendor-ledger";
import { cn } from "@/lib/utils";

interface Vendor {
  id: string;
  name: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  invoice_count: number;
  total_billed: string | number;
}

type SortKey = "name" | "email" | "status";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [edit, setEdit] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);

  async function openLedger(id: string) {
    setLedger(null);
    setLedgerOpen(true);
    try {
      const r = await fetch(`/api/vendors/ledger?id=${id}`);
      const j = await r.json();
      if (r.ok) setLedger(j);
      else {
        toast.error(j.error || "Failed to load statement");
        setLedgerOpen(false);
      }
    } catch {
      toast.error("Failed to load statement");
      setLedgerOpen(false);
    }
  }

  function load() {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((j) => setVendors(Array.isArray(j) ? j : []))
      .catch(() => setVendors([]));
  }
  useEffect(() => {
    load();
  }, []);

  function openEdit(v: Vendor) {
    setEdit(v);
    setForm({
      name: v.name ?? "",
      gstin: v.gstin ?? "",
      email: v.email ?? "",
      phone: v.phone ?? "",
      address: v.address ?? "",
    });
  }
  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      const r = await fetch("/api/vendors", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: edit.id, ...form }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success("Vendor updated");
      setEdit(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }
  async function del(id: string) {
    try {
      const r = await fetch("/api/vendors", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success("Vendor deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const rows = useMemo(() => {
    const list = (vendors ?? []).filter(
      (v) =>
        q === "" ||
        [v.name, v.email, v.gstin].join(" ").toLowerCase().includes(q.toLowerCase())
    );
    const dir = sort.dir;
    return [...list].sort((a, b) => {
      const av =
        sort.key === "status" ? (a.invoice_count > 0 ? "active" : "inactive") : (a[sort.key] ?? "");
      const bv =
        sort.key === "status" ? (b.invoice_count > 0 ? "active" : "inactive") : (b[sort.key] ?? "");
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [vendors, q, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }));
  }
  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  }

  const allChecked = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <div className="space-y-5">
      <PageHeader title="Vendors" description="Suppliers saved when you approve their invoices." />

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vendors…"
          className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSel(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 rounded border-border-strong accent-primary"
                  />
                </th>
                <th className="w-8 px-1 py-3.5"></th>
                <SortTh label="Name" onClick={() => toggleSort("name")} />
                <SortTh label="Email" onClick={() => toggleSort("email")} />
                <SortTh label="GSTIN" />
                <SortTh label="Owner" />
                <th className="px-4 py-3.5">Contact</th>
                <SortTh label="Status" onClick={() => toggleSort("status")} />
                <th className="px-4 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors === null && (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {vendors && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-14 text-center text-sm text-muted-foreground">No vendors yet — approve an invoice with a new vendor.</td></tr>
              )}
              {rows.map((v) => {
                const active = v.invoice_count > 0;
                return (
                  <tr key={v.id} className="hover:bg-surface-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={sel.has(v.id)}
                        onChange={() => toggle(sel, v.id, setSel)}
                        className="size-4 rounded border-border-strong accent-primary"
                      />
                    </td>
                    <td className="px-1 py-3">
                      <button onClick={() => toggle(favs, v.id, setFavs)}>
                        <Star className={cn("size-4", favs.has(v.id) ? "fill-amber-400 text-amber-400" : "text-border-strong hover:text-amber-400")} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openLedger(v.id)}
                        className="flex items-center gap-2.5 text-left hover:underline"
                        title="View statement"
                      >
                        <Avatar name={v.name} className="size-9" />
                        <span className="font-medium">{v.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.email || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.gstin || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">A</span>
                        <span className="text-muted-foreground">Admin User</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ContactIcon icon={Mail} title="Email" href={v.email ? `mailto:${v.email}` : undefined} />
                        <ContactIcon icon={Phone} title="Call" href={v.phone ? `tel:${v.phone}` : undefined} />
                        <ContactIcon icon={MessageSquare} title="Message" />
                        <ContactIcon
                          icon={Copy}
                          title="Copy GSTIN"
                          onClick={() => {
                            if (v.gstin) {
                              navigator.clipboard?.writeText(v.gstin);
                              toast.success("GSTIN copied");
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white", active ? "bg-[#22c55e]" : "bg-[#94a3b8]")}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RowMenu onEdit={() => openEdit(v)} onDelete={() => del(v.id)} label={v.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit Vendor"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={saving} onClick={saveEdit}>{saving ? "Saving…" : "Save changes"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="GSTIN"><Input value={form.gstin ?? ""} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></Field>
          <Field label="Email"><Input value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Address"><Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
        </div>
      </Drawer>

      <Drawer
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title="Vendor statement"
        width="max-w-2xl"
      >
        <VendorLedger data={ledger} />
      </Drawer>
    </div>
  );
}

function SortTh({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <th className="px-4 py-3.5">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1.5", onClick && "hover:text-foreground")}>
        {label}
        <ArrowUpDown className="size-3.5 text-primary/70" />
      </button>
    </th>
  );
}

function ContactIcon({
  icon: Icon,
  title,
  href,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary";
  if (href) {
    return (
      <a href={href} title={title} className={cls}>
        <Icon className="size-4" />
      </a>
    );
  }
  return (
    <button type="button" title={title} onClick={onClick} className={cls}>
      <Icon className="size-4" />
    </button>
  );
}
