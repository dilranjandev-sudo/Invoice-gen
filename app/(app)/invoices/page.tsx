"use client";

import { useEffect, useState } from "react";
import {
  Search,
  PlusCircle,
  Filter,
  Calendar,
  ChevronDown,
  ArrowDownUp,
  List,
  LayoutGrid,
  Star,
  Sparkles,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PayPill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select } from "@/components/ui/input";
import { RowMenu } from "@/components/ui/row-menu";
import { UploadExtract, ModeTabs } from "@/components/upload-extract";
import type { ExtractedInvoice } from "@/lib/invoice-types";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Row {
  uid?: string;
  id: string;
  client: string;
  project: string;
  due: string;
  amount: number;
  paid: number;
  status: "paid" | "partial" | "unpaid";
}

const usd = (n: number) => formatMoney(n, "INR");

const EMPTY_FORM: Record<string, string> = {
  vendor: "", vendorGstin: "", invoiceNumber: "", invoiceDate: "", dueDate: "",
  placeOfSupply: "", currency: "INR", subtotal: "", gst: "", total: "", status: "unpaid",
};

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null);
  const [fileName, setFileName] = useState("");
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [saveVendor, setSaveVendor] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverRows, setServerRows] = useState<Row[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawById, setRawById] = useState<Record<string, any>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [vendorNames, setVendorNames] = useState<string[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const extracted = extractedData !== null;
  const vendorName = form.vendor.trim();
  const isNewVendor =
    vendorName.length > 0 &&
    !vendorNames.some((n) => n.toLowerCase() === vendorName.toLowerCase());
  const ready = vendorName.length > 0;

  function fillFromExtract(d: ExtractedInvoice, name: string) {
    setExtractedData(d);
    setFileName(name);
    setForm({
      vendor: d.vendor ?? "",
      vendorGstin: d.vendorGstin ?? "",
      invoiceNumber: d.invoiceNumber ?? "",
      invoiceDate: d.invoiceDate ?? "",
      dueDate: d.dueDate ?? "",
      placeOfSupply: d.placeOfSupply ?? "",
      currency: d.currency ?? "INR",
      subtotal: d.subtotal != null ? String(d.subtotal) : "",
      gst: d.gst != null ? String(d.gst) : "",
      total: d.total != null ? String(d.total) : "",
      status: d.status ?? "unpaid",
    });
  }

  function openAdd() {
    setEditId(null);
    setMode("upload");
    setExtractedData(null);
    setFileName("");
    setForm(EMPTY_FORM);
    setSaveVendor(true);
    setOpen(true);
  }

  function openEdit(uid: string) {
    const r = rawById[uid];
    if (!r) return;
    setEditId(uid);
    setExtractedData(null);
    setMode("manual");
    setSaveVendor(false);
    setForm({
      vendor: r.vendor_name ?? "",
      vendorGstin: r.vendor_gstin ?? "",
      invoiceNumber: r.invoice_number ?? "",
      invoiceDate: r.invoice_date ? String(r.invoice_date).slice(0, 10) : "",
      dueDate: r.due_date ? String(r.due_date).slice(0, 10) : "",
      placeOfSupply: r.place_of_supply ?? "",
      currency: r.currency ?? "INR",
      subtotal: r.subtotal != null ? String(r.subtotal) : "",
      gst: r.gst != null ? String(r.gst) : "",
      total: r.total != null ? String(r.total) : "",
      status: r.status ?? "unpaid",
    });
    setOpen(true);
  }

  async function delInvoice(uid: string) {
    try {
      const res = await fetch("/api/invoices", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: uid }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Bill deleted");
      loadInvoices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function loadInvoices() {
    try {
      const res = await fetch("/api/invoices");
      const json = await res.json();
      if (Array.isArray(json)) {
        const map: Record<string, unknown> = {};
        for (const r of json) map[r.id] = r;
        setRawById(map);
      }
      setServerRows(
        Array.isArray(json)
          ? json.map((r) => ({
              uid: r.id,
              id: r.invoice_number || "—",
              client: r.vendor_name || "—",
              project: r.vendor_gstin || "—",
              due: r.invoice_date || "",
              amount: Number(r.total) || 0,
              paid: Number(r.amount_paid) || 0,
              status: (r.status as Row["status"]) || "unpaid",
            }))
          : []
      );
    } catch {
      setServerRows([]);
    }
  }
  async function loadVendorNames() {
    try {
      const res = await fetch("/api/vendors");
      const json = await res.json();
      if (Array.isArray(json)) setVendorNames(json.map((v: { name: string }) => v.name));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadInvoices();
    loadVendorNames();
  }, []);

  async function createInvoice() {
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch("/api/invoices", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editId, ...form }),
        });
        if (!res.ok) {
          toast.error((await res.json()).error || "Save failed");
          return;
        }
        toast.success("Bill updated");
        setOpen(false);
        setEditId(null);
        loadInvoices();
        return;
      }
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          saveVendor: isNewVendor && saveVendor,
          vendorAddress: extractedData?.vendorAddress ?? null,
          vendorPhone: extractedData?.vendorPhone ?? null,
          vendorEmail: extractedData?.vendorEmail ?? null,
          buyer: extractedData?.buyer ?? null,
          buyerGstin: extractedData?.buyerGstin ?? null,
          cgst: extractedData?.cgst ?? null,
          sgst: extractedData?.sgst ?? null,
          igst: extractedData?.igst ?? null,
          amountPaid: extractedData?.amountPaid ?? null,
          balance: extractedData?.balance ?? null,
          items: extractedData?.items ?? null,
          bankName: extractedData?.bankName ?? null,
          bankAccount: extractedData?.bankAccount ?? null,
          bankIfsc: extractedData?.bankIfsc ?? null,
          raw: extractedData ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Save failed");
        return;
      }
      if (isNewVendor && saveVendor) toast.success(`Vendor “${vendorName}” saved`);
      toast.success("Invoice saved");
      setOpen(false);
      loadInvoices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const baseRows = serverRows ?? [];
  const data = baseRows.filter(
    (r) => q === "" || (r.client + r.project + r.id).toLowerCase().includes(q.toLowerCase())
  );
  const allChecked = data.length > 0 && data.every((r) => sel.has(r.id));

  function toggleFav(id: string) {
    setFavs((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleSel(id: string) {
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={openAdd} className="sm:self-end">
          <PlusCircle className="size-4" /> Upload a Bill
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarBtn className="font-semibold text-foreground">
          All Bills <ChevronDown className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn>
          <Filter className="size-4" /> Filter <ChevronDown className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn>
          <Calendar className="size-4" /> 1 Jun 25 - 30 Jun 25
        </ToolbarBtn>

        <div className="ml-auto flex items-center gap-2">
          <ToolbarBtn>
            <ArrowDownUp className="size-4" /> Sort By <ChevronDown className="size-4" />
          </ToolbarBtn>
          <div className="inline-flex overflow-hidden rounded-lg border border-border-strong">
            <button className="grid size-9 place-items-center bg-primary text-primary-foreground">
              <List className="size-4" />
            </button>
            <button className="grid size-9 place-items-center text-muted-foreground hover:bg-surface-muted">
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() =>
                      setSel(allChecked ? new Set() : new Set(data.map((r) => r.id)))
                    }
                    className="size-4 rounded border-border-strong accent-primary"
                  />
                </th>
                <th className="w-8 px-1 py-3.5"></th>
                <th className="px-4 py-3.5">Invoice ID</th>
                <th className="px-4 py-3.5">Vendor</th>
                <th className="px-4 py-3.5">GSTIN</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Paid Amount</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {serverRows === null && (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {serverRows && data.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-muted-foreground">No invoices yet — click <span className="font-medium text-foreground">Add New Invoice</span> to upload a bill.</td></tr>
              )}
              {data.map((r) => (
                <tr key={r.uid ?? r.id} className="hover:bg-surface-muted/30">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={sel.has(r.id)}
                      onChange={() => toggleSel(r.id)}
                      className="size-4 rounded border-border-strong accent-primary"
                    />
                  </td>
                  <td className="px-1 py-3.5">
                    <button onClick={() => toggleFav(r.id)}>
                      <Star
                        className={cn(
                          "size-4",
                          favs.has(r.id)
                            ? "fill-amber-400 text-amber-400"
                            : "text-border-strong hover:text-amber-400"
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{r.id}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.client} />
                      <span className="font-medium">{r.client}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {r.project}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{r.due ? formatDate(r.due) : "—"}</td>
                  <td className="px-4 py-3.5 text-foreground">{usd(r.amount)}</td>
                  <td className="px-4 py-3.5 text-foreground">{usd(r.paid)}</td>
                  <td className="px-4 py-3.5">
                    <PayPill status={r.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    {r.uid ? (
                      <RowMenu onEdit={() => openEdit(r.uid!)} onDelete={() => delInvoice(r.uid!)} label={`bill ${r.id}`} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Invoice drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit Bill" : "Add a Bill"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!ready || saving} onClick={createInvoice}>
              {saving ? "Saving…" : editId ? "Save changes" : extracted ? "Approve & Save" : "Create New"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editId && (
            <ModeTabs mode={mode} onUpload={() => { setMode("upload"); setExtractedData(null); setFileName(""); setForm(EMPTY_FORM); }} onManual={() => setMode("manual")} />
          )}

          {mode === "upload" && !extracted ? (
            <UploadExtract onExtracted={fillFromExtract} />
          ) : extracted ? (
            <ExtractedReview
              data={extractedData!}
              fileName={fileName}
              isNewVendor={isNewVendor}
              saveVendor={saveVendor}
              onToggleSave={setSaveVendor}
            />
          ) : (
            <div className="space-y-4">
              <Req label="Vendor">
                <Input value={form.vendor} onChange={(e) => upd("vendor", e.target.value)} placeholder="Vendor / supplier name" />
              </Req>
              {isNewVendor && (
                <VendorSaveToggle name={vendorName} checked={saveVendor} onChange={setSaveVendor} />
              )}
              <div className="grid grid-cols-2 gap-4">
                <Req label="Invoice No.">
                  <Input value={form.invoiceNumber} onChange={(e) => upd("invoiceNumber", e.target.value)} placeholder="e.g. 68" />
                </Req>
                <Req label="GSTIN">
                  <Input value={form.vendorGstin} onChange={(e) => upd("vendorGstin", e.target.value)} placeholder="GSTIN" />
                </Req>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Req label="Invoice Date">
                  <Input type="date" value={form.invoiceDate} onChange={(e) => upd("invoiceDate", e.target.value)} />
                </Req>
                <Req label="Due Date">
                  <Input type="date" value={form.dueDate} onChange={(e) => upd("dueDate", e.target.value)} />
                </Req>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Req label="Place of Supply">
                  <Input value={form.placeOfSupply} onChange={(e) => upd("placeOfSupply", e.target.value)} placeholder="e.g. 07-Delhi" />
                </Req>
                <Req label="Currency">
                  <Input value={form.currency} onChange={(e) => upd("currency", e.target.value)} placeholder="INR" />
                </Req>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Req label="Taxable Amount">
                  <Input type="number" value={form.subtotal} onChange={(e) => upd("subtotal", e.target.value)} placeholder="0" />
                </Req>
                <Req label="GST">
                  <Input type="number" value={form.gst} onChange={(e) => upd("gst", e.target.value)} placeholder="0" />
                </Req>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Req label="Total">
                  <Input type="number" value={form.total} onChange={(e) => upd("total", e.target.value)} placeholder="0" />
                </Req>
                <Req label="Status">
                  <Select value={form.status} onChange={(e) => upd("status", e.target.value)}>
                    <option value="paid">Paid</option>
                    <option value="partial">Partially Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </Select>
                </Req>
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}

function ToolbarBtn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted",
        className
      )}
    >
      {children}
    </button>
  );
}

function Req({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label} <span className="text-primary">*</span>
      </span>
      {children}
    </label>
  );
}

/* ---- Extracted review (read-only) ------------------------------------------ */

function ExtractedReview({
  data,
  fileName,
  isNewVendor,
  saveVendor,
  onToggleSave,
}: {
  data: ExtractedInvoice;
  fileName: string;
  isNewVendor: boolean;
  saveVendor: boolean;
  onToggleSave: (v: boolean) => void;
}) {
  const money = (n: number | null) =>
    n != null ? formatMoney(Number(n), data.currency || "INR") : "—";

  return (
    <div className="space-y-4">
      {/* Source file + accuracy */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/40 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{fileName || "Uploaded file"}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" /> Extracted by AI
            </div>
          </div>
        </div>
        {data.confidence != null && <AccuracyPill value={Math.round(data.confidence)} />}
      </div>

      <ReviewSection title="Vendor">
        <KV k="Name" v={data.vendor} />
        <KV k="GSTIN" v={data.vendorGstin} mono />
        <KV k="Email" v={data.vendorEmail} />
        <KV k="Phone" v={data.vendorPhone} />
      </ReviewSection>

      {isNewVendor && (
        <VendorSaveToggle name={data.vendor ?? ""} checked={saveVendor} onChange={onToggleSave} />
      )}

      <ReviewSection title="Invoice">
        <KV k="Invoice No." v={data.invoiceNumber} />
        <KV k="Date" v={data.invoiceDate} />
        <KV k="Due Date" v={data.dueDate} />
        <KV k="Place of Supply" v={data.placeOfSupply} />
      </ReviewSection>

      <ReviewSection title="Amounts">
        <KV k="Taxable" v={money(data.subtotal)} />
        {data.cgst != null && <KV k="CGST" v={money(data.cgst)} />}
        {data.sgst != null && <KV k="SGST" v={money(data.sgst)} />}
        {data.igst != null && <KV k="IGST" v={money(data.igst)} />}
        <KV k="Total GST" v={money(data.gst)} />
        <KV k="Total" v={money(data.total)} strong />
        <KV k="Paid" v={money(data.amountPaid)} />
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <PayPill status={data.status ?? "unpaid"} />
          </dd>
        </div>
      </ReviewSection>

      {data.items && data.items.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Items ({data.items.length})
          </div>
          <div className="divide-y divide-border rounded-md border border-border">
            {data.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{it.name ?? "Item"}</span>
                <span className="shrink-0 font-medium">{money(it.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono, strong }: { k: string; v: string | null; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", mono ? "font-mono text-xs" : "", strong ? "font-semibold" : "font-medium")}>
        {v || "—"}
      </dd>
    </div>
  );
}

function AccuracyPill({ value }: { value: number }) {
  const tone =
    value >= 90 ? "bg-emerald-100 text-emerald-700"
    : value >= 75 ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-600";
  return (
    <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-semibold", tone)}>
      {value}% accuracy
    </span>
  );
}

function VendorSaveToggle({ name, checked, onChange }: { name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 rounded-md border border-primary/30 bg-primary-soft/50 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-border-strong accent-primary"
      />
      <span className="text-sm">
        <span className="font-medium">Save “{name}” as a new vendor</span>
        <span className="block text-xs text-muted-foreground">
          Not in your vendor list yet — we&apos;ll add it with the extracted details.
        </span>
      </span>
    </label>
  );
}
