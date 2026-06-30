"use client";

import { useRouter } from "next/navigation";
import { Receipt, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Welcome back, Admin");
    router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-md bg-white/15">
            <Receipt className="size-6" />
          </div>
          <span className="text-lg font-semibold">PayRecord</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Every company payment,
            <br /> matched &amp; recorded.
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            Connect Gmail, upload your bills, and let AI match each invoice to its
            payment. You review and approve — nothing is finalised automatically.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © 2026 The Ledger Labs
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Receipt className="size-6" />
            </div>
            <span className="text-lg font-semibold">PayRecord</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to manage your payment records and Gmail sync.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  defaultValue="support@theledgerlabs.com"
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
                  defaultValue="password"
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </Field>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" defaultChecked className="size-4 rounded border-border-strong accent-primary" />
                Remember me
              </label>
              <span className="text-muted-foreground/60">Forgot password?</span>
            </div>

            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
