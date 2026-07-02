"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TwoFactorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    fetch("/api/twofa").then((r) => r.json()).then((j) => setEnabled(!!j.enabled)).catch(() => setEnabled(false));
  }, []);

  async function startSetup() {
    setBusy(true);
    try {
      const r = await fetch("/api/twofa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setup" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSetup(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    setBusy(true);
    try {
      const r = await fetch("/api/twofa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "enable", code }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success("Two-factor authentication enabled");
      setEnabled(true); setSetup(null); setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const r = await fetch("/api/twofa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "disable", code }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success("Two-factor authentication turned off");
      setEnabled(false); setDisabling(false); setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : enabled ? (
          <>
            <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success"><ShieldCheck className="size-4" /> 2FA is on — you&apos;ll enter a code from your authenticator app at login.</div>
            {!disabling ? (
              <Button variant="outline" onClick={() => setDisabling(true)}><ShieldOff className="size-4" /> Turn off 2FA</Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Enter a current 6-digit code to turn it off.</p>
                <div className="flex gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="123456" className="max-w-[140px] tracking-[0.3em]" />
                  <Button variant="danger" disabled={busy} onClick={disable}>Turn off</Button>
                  <Button variant="ghost" onClick={() => { setDisabling(false); setCode(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        ) : setup ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              1. In Google Authenticator / Authy tap <span className="font-medium text-foreground">Add → Enter a setup key</span> and paste the key below (or scan the URI).
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-sm text-foreground">{setup.secret}</code>
              <button onClick={() => { navigator.clipboard?.writeText(setup.secret); toast.success("Key copied"); }} className="grid size-8 shrink-0 place-items-center rounded-md border border-border-strong text-muted-foreground hover:bg-primary-soft hover:text-primary"><Copy className="size-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground">2. Enter the 6-digit code it shows to confirm:</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="123456" className="max-w-[140px] tracking-[0.3em]" />
              <Button disabled={busy || code.length !== 6} onClick={enable}>Verify &amp; enable</Button>
              <Button variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Add a second layer to your login with an authenticator app (Google Authenticator, Authy, 1Password).</p>
            <Button disabled={busy} onClick={startSetup}><ShieldCheck className="size-4" /> Enable 2FA</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
