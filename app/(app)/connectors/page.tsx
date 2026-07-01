"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, RefreshCw, Unlink, Loader2, ShieldCheck, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

interface Account {
  id: string;
  email: string;
  status: string;
  last_sync_at: string | null;
  payment_count: number;
}

function GmailMark() {
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface">
      <svg viewBox="0 0 24 24" className="size-5">
        <path fill="#4285F4" d="M3 19h3V8.5l6 4.3 6-4.3V19h3V6.2c0-1-1.2-1.6-2-1L12 10 5.9 5.2c-.8-.6-2 0-2 1z" />
        <path fill="#EA4335" d="M3 6.2 12 12.6 21 6.2c0-1-1.2-1.6-2-1L12 10 5 5.2c-.8-.6-2 0-2 1z" />
        <path fill="#34A853" d="M3 19h3v-8l-3-2.2z" />
        <path fill="#FBBC04" d="M21 19h-3v-8l3-2.2z" />
      </svg>
    </div>
  );
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ConnectorsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/gmail/accounts");
      const j = await r.json();
      setAccounts(Array.isArray(j) ? j : []);
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast.success(`Connected ${params.get("connected")}`);
      window.history.replaceState({}, "", "/connectors");
    } else if (params.get("error")) {
      const e = params.get("error");
      toast.error(e === "no_google_creds" ? "Google OAuth not configured (set GOOGLE_CLIENT_ID/SECRET)." : `Connect failed: ${e}`);
      window.history.replaceState({}, "", "/connectors");
    }
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const r = await fetch("/api/gmail/sync-all", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Sync failed");
      const p = j.payments?.synced ?? 0;
      const b = j.bills?.imported ?? 0;
      const parts = [];
      if (p > 0) parts.push(`${p} payment${p === 1 ? "" : "s"}`);
      if (b > 0) parts.push(`${b} bill${b === 1 ? "" : "s"}`);
      if (j.rateLimited) {
        toast(`Synced ${parts.join(" · ") || "0"} — AI is busy, the rest will sync shortly.`);
      } else {
        toast.success(parts.length ? `Synced — ${parts.join(" · ")}` : "You're up to date");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function rescan() {
    toast("Re-scan whole inbox?", {
      description: "Reads every payment email again — even ones synced before. Uses some AI quota.",
      action: {
        label: "Re-scan",
        onClick: async () => {
          setSyncing(true);
          try {
            const c = await fetch("/api/gmail/rescan", { method: "POST" });
            const cj = await c.json();
            if (!c.ok) throw new Error(cj.error || "Re-scan failed");
            const r = await fetch("/api/gmail/sync-all", { method: "POST" });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || "Sync failed");
            const p = j.payments?.synced ?? 0;
            const b = j.bills?.imported ?? 0;
            if (j.rateLimited) {
              toast(`Re-scanning — ${p} payments · ${b} bills pulled, AI is busy, the rest will follow.`);
            } else {
              toast.success(`Re-scan complete — ${p} payment${p === 1 ? "" : "s"} · ${b} bill${b === 1 ? "" : "s"}`);
            }
            load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Re-scan failed");
          } finally {
            setSyncing(false);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  async function disconnect(id: string, email: string) {
    toast(`Disconnect ${email}?`, {
      action: {
        label: "Disconnect",
        onClick: async () => {
          try {
            await fetch("/api/gmail/accounts", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id }),
            });
            toast.success("Account disconnected");
            load();
          } catch {
            toast.error("Failed to disconnect");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  const connect = () => (window.location.href = "/api/gmail/connect");
  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail"
        description="Connect Gmail so payments land here automatically — no forwarding, no spreadsheets."
        actions={
          hasAccounts ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={rescan} disabled={syncing} title="Re-read every email, including ones synced before">
                <History className="size-4" /> Re-scan
              </Button>
              <Button variant="outline" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button onClick={connect}>
                <Plus className="size-4" /> Add account
              </Button>
            </div>
          ) : undefined
        }
      />

      {accounts === null ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !hasAccounts ? (
        /* Empty state */
        <div className="rounded-md border border-border bg-surface px-6 py-16 text-center shadow-card">
          <div className="mx-auto w-fit">
            <GmailMark />
          </div>
          <h3 className="mt-4 text-base font-semibold">Connect your Gmail</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            PayRecord reads bank, UPI and gateway payment emails, then matches each one to a bill for you.
          </p>
          <Button className="mt-5" onClick={connect}>
            <Plus className="size-4" /> Connect Gmail
          </Button>
        </div>
      ) : (
        <>
          {/* Account list */}
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface shadow-card">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-4">
                <GmailMark />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{a.email}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                      <span className="size-1.5 rounded-full bg-success" /> Connected
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {a.payment_count} payment{a.payment_count === 1 ? "" : "s"} · synced {timeAgo(a.last_sync_at)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                  onClick={() => disconnect(a.id, a.email)}
                >
                  <Unlink className="size-3.5" /> Disconnect
                </Button>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="flex items-start gap-3 rounded-md border border-border bg-surface-muted/40 px-4 py-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              PayRecord checks your inbox every few minutes and records each payment automatically. Deleting a payment
              keeps it gone — use <span className="font-medium text-foreground">Re-scan</span> to pull every email
              again from scratch.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
