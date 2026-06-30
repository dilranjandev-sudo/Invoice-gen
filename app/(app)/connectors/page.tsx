"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  Unlink,
  Loader2,
  MessageCircle,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
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
    <div className="grid size-10 place-items-center rounded-md bg-danger-soft">
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
      if (Array.isArray(j)) setAccounts(j);
      else setAccounts([]);
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

  async function disconnect(id: string) {
    try {
      await fetch("/api/gmail/accounts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast("Account disconnected");
      load();
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Connect Gmail so PayRecord can read your payment confirmations."
        actions={
          <div className="flex items-center gap-2">
            {accounts && accounts.length > 0 && (
              <Button variant="outline" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            )}
            <Button onClick={() => (window.location.href = "/api/gmail/connect")}>
              <Plus className="size-4" /> Add Gmail Account
            </Button>
          </div>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Gmail Accounts</h2>

        {accounts === null && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {accounts && accounts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <GmailMark />
              <div className="mt-1 text-sm font-medium">No Gmail connected</div>
              <div className="max-w-sm text-xs text-muted-foreground">
                Connect a Gmail account to automatically pull bank, UPI and gateway payment emails.
              </div>
              <Button className="mt-2" onClick={() => (window.location.href = "/api/gmail/connect")}>
                <Plus className="size-4" /> Connect Gmail
              </Button>
            </CardContent>
          </Card>
        )}

        {accounts && accounts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {accounts.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <GmailMark />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.payment_count} payments · last sync {timeAgo(a.last_sync_at)}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={a.status} kind="connection" />
                  </div>
                  <div className="flex items-center gap-1.5 border-t border-border pt-3">
                    <Button variant="ghost" size="sm" onClick={sync} disabled={syncing}>
                      <RefreshCw className="size-3.5" /> Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => disconnect(a.id)}
                    >
                      <Unlink className="size-3.5" /> Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Other Sources</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { name: "Bank Statement Feed", desc: "Auto-import payments from bank feeds", icon: Landmark },
            { name: "WhatsApp Invoices", desc: "Import bills shared on WhatsApp", icon: MessageCircle },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.name}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-md bg-surface-muted text-muted-foreground">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.desc}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Soon
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
