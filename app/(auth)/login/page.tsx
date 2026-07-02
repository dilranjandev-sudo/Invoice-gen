"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

// Static demo credentials (no backend auth yet).
const DEMO_EMAIL = "support@biqadx.com";
const DEMO_PASSWORD = "payrecord123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, code: need2fa ? code : undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        toast.success("Welcome back");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (j.need2fa) {
        setNeed2fa(true);
        setError(r.status === 401 ? "Wrong code — try again." : "");
        setBusy(false);
        return;
      }
      setError("Incorrect email or password.");
      setBusy(false);
    } catch {
      setError("Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      {/* soft backdrop accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 size-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to PayRecord</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your payment records and Gmail sync.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card-lg">
          {/* Demo credentials hint */}
          <div className="mb-5 flex items-start justify-between gap-3 rounded-md border border-border bg-surface-muted/50 p-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground">Demo login</div>
              <div className="text-muted-foreground">{DEMO_EMAIL}</div>
              <div className="text-muted-foreground">Password: {DEMO_PASSWORD}</div>
            </div>
            <button
              type="button"
              onClick={fillDemo}
              className="shrink-0 rounded-sm border border-border-strong bg-surface px-2.5 py-1 font-medium text-primary hover:bg-primary-soft"
            >
              Fill
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="you@company.com"
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </Field>

            {need2fa && (
              <Field label="Authenticator code">
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-9 tracking-[0.3em]"
                    placeholder="123456"
                  />
                </div>
              </Field>
            )}

            {error && <p className="text-sm font-medium text-danger">{error}</p>}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" defaultChecked className="size-4 rounded border-border-strong accent-primary" />
                Remember me
              </label>
              <span className="cursor-pointer text-muted-foreground/60 hover:text-muted-foreground">Forgot password?</span>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : need2fa ? "Verify & sign in" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">© 2026 Biqadx Private Limited · PayRecord</p>
      </div>
    </div>
  );
}
