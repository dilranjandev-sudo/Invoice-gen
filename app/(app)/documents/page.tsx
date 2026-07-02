"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, ExternalLink, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Field, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

const CATS = ["Incorporation", "GST", "PAN / TAN", "Agreements", "Licenses", "Bank", "Other"];

export default function DocumentsPage() {
  const [rows, setRows] = useState<Doc[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Incorporation", notes: "" });
  const [file, setFile] = useState<{ dataUrl: string; filename: string } | null>(null);
  const [filter, setFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setRows(await (await fetch("/api/documents")).json());
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function pickFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return toast.error("File too large — keep it under 5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ dataUrl: String(reader.result), filename: f.name });
      setForm((s) => ({ ...s, name: s.name || f.name.replace(/\.[^.]+$/, "") }));
      setOpen(true);
    };
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const r = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, filename: file.filename, data: file.dataUrl }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success("Document saved");
      setOpen(false);
      setFile(null);
      setForm({ name: "", category: "Incorporation", notes: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }
  function del(id: string) {
    toast("Delete this document?", {
      action: { label: "Delete", onClick: async () => { await fetch("/api/documents", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); load(); } },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  const data = (rows ?? []).filter((d) => filter === "all" || d.category === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Keep your company papers in one place — incorporation, GST, PAN, agreements, licenses."
        actions={<Button onClick={() => inputRef.current?.click()}><Upload className="size-4" /> Upload document</Button>}
      />
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }} />

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border-strong bg-surface p-1 text-sm">
        {["all", ...CATS].map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`rounded-sm px-3 py-1.5 font-medium capitalize transition-colors ${filter === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted"}`}>
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-6 py-16 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No documents here yet. Upload your incorporation certificate, GST certificate, PAN, agreements…</p>
          <Button className="mt-4" onClick={() => inputRef.current?.click()}><Upload className="size-4" /> Upload document</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((d) => (
            <div key={d.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><FileText className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name || d.filename}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{d.category} · {formatDate(d.created_at)}</div>
                {d.notes && <div className="mt-1 truncate text-xs text-muted-foreground">{d.notes}</div>}
                <div className="mt-2 flex items-center gap-2">
                  <a href={`/api/documents/file?id=${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <ExternalLink className="size-3.5" /> View
                  </a>
                  <button onClick={() => del(d.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={open} onClose={() => { setOpen(false); setFile(null); }} title="Save document"
        footer={<><Button variant="outline" onClick={() => { setOpen(false); setFile(null); }}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-4">
          {file && <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted/40 p-3 text-sm"><FileText className="size-4 text-primary" /> <span className="truncate">{file.filename}</span></div>}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Certificate of Incorporation" /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional" /></Field>
        </div>
      </Drawer>
    </div>
  );
}
