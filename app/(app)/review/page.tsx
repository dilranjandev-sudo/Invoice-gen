"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  FileText,
  Banknote,
  ArrowRight,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney, formatDate, cn } from "@/lib/utils";

interface Item {
  id: string;
  payee: string | null;
  amount: string | number | null;
  currency: string | null;
  paid_on: string | null;
  channel: string | null;
  account_detail: string | null;
  match_score: string | number | null;
  matched_invoice_no: string | null;
  matched_invoice_total: string | number | null;
}

export default function ReviewPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/payments");
      const j = await r.json();
      setItems(Array.isArray(j) ? j.filter((p: { status: string }) => p.status === "matched") : []);
    } catch {
      setItems([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const r = await fetch("/api/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: id, action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      if (action === "approve") {
        toast.success(j.emailed ? "Approved — payment email sent to vendor ✉️" : "Approved & marked paid");
      } else {
        toast.success("Marked as not a match");
      }
      setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const score = (s: string | number | null) => (s != null ? Math.round(Number(s)) : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="To Review"
        description="We matched these payments to a bill. Give them a quick check and approve."
      />

      {items === null && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}

      {items && items.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="text-base font-semibold">You&apos;re all caught up</div>
            <div className="max-w-sm text-sm text-muted-foreground">
              Nothing to review right now. New matched payments will show up here automatically.
            </div>
          </div>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((it) => {
            const sc = score(it.match_score);
            const strong = sc != null && sc >= 90;
            return (
              <Card key={it.id} className="overflow-hidden p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={it.payee || "Vendor"} className="size-9" />
                    <div className="font-semibold">{it.payee || "Vendor"}</div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                      strong ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    <Sparkles className="size-3.5" />
                    {strong ? "Strong match" : "Possible match"}
                    {sc != null && ` · ${sc}%`}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-center gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr]">
                  {/* Bill */}
                  <div className="rounded-xl border border-border bg-surface-muted/30 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <FileText className="size-3.5" /> Bill
                    </div>
                    <div className="mt-1.5 text-lg font-semibold">
                      {it.matched_invoice_total != null ? formatMoney(Number(it.matched_invoice_total), it.currency || "INR") : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">Invoice {it.matched_invoice_no || "—"}</div>
                  </div>

                  <div className="hidden place-items-center sm:grid">
                    <div className="grid size-8 place-items-center rounded-full bg-surface-muted text-muted-foreground">
                      <ArrowRight className="size-4" />
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="rounded-xl border border-border bg-surface-muted/30 p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Banknote className="size-3.5" /> Payment
                    </div>
                    <div className="mt-1.5 text-lg font-semibold">
                      {it.amount != null ? formatMoney(Number(it.amount), it.currency || "INR") : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {[it.channel, it.paid_on ? formatDate(it.paid_on) : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={busy === it.id}
                    onClick={() => act(it.id, "reject")}
                  >
                    <X className="size-4" /> Not a match
                  </Button>
                  <Button
                    disabled={busy === it.id}
                    className="bg-[#16a34a] hover:bg-[#15803d]"
                    onClick={() => act(it.id, "approve")}
                  >
                    {busy === it.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Approve &amp; mark paid
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
