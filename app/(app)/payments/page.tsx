"use client";

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  Sparkles,
  Wallet,
  CheckCircle2,
  CircleDashed,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge, MatchScore } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input, Select, Field } from "@/components/ui/input";
import { RowMenu } from "@/components/ui/row-menu";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Payment {
  id: string;
  payee: string | null;
  amount: string | number | null;
  currency: string | null;
  paid_on: string | null;
  reference: string | null;
  utr: string | null;
  mode: string | null;
  channel: string | null;
  account_detail: string | null;
  status: string;
  source_email: string | null;
  matched_invoice_no: string | null;
  match_score: string | number | null;
  subject: string | null;
  body: string | null;
}

const tabs = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "unmatched", label: "Unmatched" },
];

function GmailGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0">
      <path fill="#4285F4" d="M3 19h3V8.5l6 4.3 6-4.3V19h3V6.2c0-1-1.2-1.6-2-1L12 10 5.9 5.2c-.8-.6-2 0-2 1z" />
      <path fill="#EA4335" d="M3 6.2 12 12.6 21 6.2c0-1-1.2-1.6-2-1L12 10 5 5.2c-.8-.6-2 0-2 1z" />
      <path fill="#34A853" d="M3 19h3v-8l-3-2.2z" />
      <path fill="#FBBC04" d="M21 19h-3v-8l3-2.2z" />
    </svg>
  );
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [edit, setEdit] = useState<Payment | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewP, setViewP] = useState<Payment | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/payments");
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openEdit(p: Payment) {
    setEdit(p);
    setForm({ payee: p.payee ?? "", amount: p.amount != null ? String(p.amount) : "", status: p.status });
  }
  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      const r = await fetch("/api/payments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: edit.id, ...form }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success("Payment updated");
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
      const r = await fetch("/api/payments", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      toast.success("Payment deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await fetch("/api/gmail/sync", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sync failed");
      if (j.rateLimited) {
        toast(`Synced ${j.synced} — AI is busy (free-tier limit), the rest will sync shortly.`);
      } else {
        toast.success(`Synced — ${j.synced} new payment${j.synced === 1 ? "" : "s"}`);
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function runMatch() {
    setMatching(true);
    try {
      const r = await fetch("/api/match", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Matching failed");
      toast.success(`AI matched ${j.matched} payment${j.matched === 1 ? "" : "s"} to invoices`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Matching failed");
    } finally {
      setMatching(false);
    }
  }

  const all = rows ?? [];
  const sum = all.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const matchedCount = all.filter((p) => p.status === "matched").length;
  const unmatchedCount = all.length - matchedCount;

  const data = all.filter((p) => {
    const okTab = tab === "all" || p.status === tab;
    const okQ =
      q === "" ||
      [p.payee, p.reference, p.utr, p.channel, p.source_email, String(p.amount)]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase());
    return okTab && okQ;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="Payment confirmations pulled from your connected Gmail."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={runMatch} disabled={matching || all.length === 0}>
              {matching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {matching ? "Matching…" : "Run AI Match"}
            </Button>
            <Button onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {syncing ? "Syncing…" : "Sync from Gmail"}
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={Wallet} tone="bg-primary-soft text-primary" label="Total Payments" value={formatMoney(sum)} sub={`${all.length} records`} />
        <SummaryCard icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Matched" value={String(matchedCount)} sub="linked to invoices" />
        <SummaryCard icon={CircleDashed} tone="bg-amber-50 text-amber-600" label="Unmatched" value={String(unmatchedCount)} sub="need review" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search payee, reference, UTR, email…"
            className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted-foreground hover:bg-surface-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Mode / Source</th>
                <th className="px-5 py-3.5">Reference / UTR</th>
                <th className="px-5 py-3.5">Match</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null && (
                <tr><td colSpan={8} className="px-5 py-12 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {rows && data.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No payments — connect Gmail and hit <span className="font-medium text-foreground">Sync from Gmail</span>.
                  </td>
                </tr>
              )}
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/30">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.payee || "Unknown"} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.payee || "—"}</div>
                        {p.source_email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GmailGlyph />
                            <span className="truncate">{p.source_email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-medium">
                    {p.amount != null ? formatMoney(Number(p.amount), p.currency || "INR") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {p.paid_on ? formatDate(p.paid_on) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div>{p.mode || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[p.channel, p.account_detail].filter(Boolean).join(" ")}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                    {p.utr || p.reference || "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.matched_invoice_no ? (
                      <div className="flex flex-col items-start gap-1">
                        <MatchScore score={p.match_score != null ? Math.round(Number(p.match_score)) : null} />
                        <span className="font-mono text-[11px] text-muted-foreground">{p.matched_invoice_no}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={p.status === "unmatched" ? "no_match" : p.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {(p.body || p.subject) && (
                        <button
                          onClick={() => setViewP(p)}
                          title="View email"
                          className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-primary-soft hover:text-primary"
                        >
                          <Mail className="size-4" />
                        </button>
                      )}
                      <RowMenu onEdit={() => openEdit(p)} onDelete={() => del(p.id)} label={`payment from ${p.payee || "vendor"}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Edit Payment"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={saving} onClick={saveEdit}>{saving ? "Saving…" : "Save changes"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Payee"><Input value={form.payee ?? ""} onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))} /></Field>
          <Field label="Amount"><Input type="number" value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Status">
            <Select value={form.status ?? "unmatched"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="unmatched">Unmatched</option>
              <option value="matched">Matched</option>
              <option value="approved">Approved</option>
            </Select>
          </Field>
        </div>
      </Drawer>

      {/* Email viewer */}
      <Drawer open={viewP !== null} onClose={() => setViewP(null)} title="Payment email" width="max-w-xl">
        {viewP && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-surface-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{viewP.payee || "—"}</div>
                <div className="text-lg font-bold tabular-nums">
                  {viewP.amount != null ? formatMoney(Number(viewP.amount), viewP.currency || "INR") : "—"}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {viewP.paid_on && <span>{formatDate(viewP.paid_on)}</span>}
                {viewP.mode && <span>· {viewP.mode}</span>}
                {(viewP.utr || viewP.reference) && <span>· Ref {viewP.utr || viewP.reference}</span>}
              </div>
              {viewP.source_email && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <GmailGlyph /> {viewP.source_email}
                </div>
              )}
            </div>

            {viewP.subject && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">Subject</div>
                <div className="mt-0.5 text-sm font-medium">{viewP.subject}</div>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Email content</div>
              <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-sm leading-relaxed text-foreground">
                {viewP.body || "No content saved for this email."}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  tone: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </Card>
  );
}
