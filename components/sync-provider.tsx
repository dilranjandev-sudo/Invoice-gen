"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, Inbox, Sparkles, GitCompareArrows, Check, Loader2, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "idle" | "running" | "done";

const STEPS = [
  { key: "gmail", title: "Gmail", desc: "Trigger", icon: Mail },
  { key: "payments", title: "Payments", desc: "Fetch + AI", icon: Inbox },
  { key: "bills", title: "Bills", desc: "PDF + rules", icon: Sparkles },
  { key: "match", title: "Match", desc: "Bill ↔ pay", icon: GitCompareArrows },
] as const;

const SyncCtx = createContext<{ run: () => void; running: boolean }>({ run: () => {}, running: false });
export const useSync = () => useContext(SyncCtx);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  useEffect(() => setMounted(true), []);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setOpen(true);
    setResults({});
    setActive(0);
    try {
      const acc = await fetch("/api/gmail/accounts").then((r) => r.json());
      const nAcc = Array.isArray(acc) ? acc.length : 0;
      setResults((r) => ({ ...r, gmail: `${nAcc} account${nAcc === 1 ? "" : "s"}` }));
      if (nAcc === 0) {
        toast.error("No Gmail connected — connect one first.");
        setActive(null);
        setRunning(false);
        await sleep(1200);
        setOpen(false);
        return;
      }
      await sleep(300);

      setActive(1);
      const p = await fetch("/api/gmail/sync", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({ ...r, payments: p.rateLimited ? `${p.synced ?? 0} new · busy` : `${p.synced ?? 0} new` }));

      setActive(2);
      const b = await fetch("/api/gmail/import-bills", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({ ...r, bills: b.rateLimited ? `${b.imported ?? 0} · busy` : `${b.imported ?? 0} imported` }));

      setActive(3);
      const m = await fetch("/api/match", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({ ...r, match: `${m.matched ?? 0} matched` }));

      setActive(null);
      const parts: string[] = [];
      if (p.synced) parts.push(`${p.synced} payment${p.synced === 1 ? "" : "s"}`);
      if (b.imported) parts.push(`${b.imported} bill${b.imported === 1 ? "" : "s"}`);
      toast.success(parts.length ? `Synced — ${parts.join(" · ")}` : "You're up to date");
      window.dispatchEvent(new Event("payrecord:synced"));
      await sleep(1100);
      setOpen(false);
    } catch {
      toast.error("Sync failed");
      setActive(null);
    }
    setRunning(false);
  }, [running]);

  function statusOf(i: number, key: string): Status {
    if (i === active) return "running";
    if (results[key] != null) return "done";
    return "idle";
  }

  const modal = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => !running && setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-card-lg">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", running ? "animate-pulse bg-warning" : "bg-success")} />
            <h3 className="text-sm font-semibold">{running ? "Running sync…" : "Sync complete"}</h3>
          </div>
          {!running && (
            <button onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-stretch justify-between">
          {STEPS.map((step, i) => {
            const st = statusOf(i, step.key);
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-1 flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative grid size-11 place-items-center rounded-lg border transition-colors",
                      st === "running" ? "border-primary bg-primary text-primary-foreground ring-2 ring-ring"
                        : st === "done" ? "border-success/50 bg-success-soft text-success"
                        : "border-border bg-surface-muted text-muted-foreground"
                    )}
                  >
                    {st === "running" ? <Loader2 className="size-5 animate-spin" /> : st === "done" ? <Check className="size-5" /> : <Icon className="size-5" />}
                  </div>
                  <div className="mt-2 text-xs font-semibold">{step.title}</div>
                  <div className="h-4 text-[11px] text-muted-foreground">
                    {results[step.key] ?? (st === "running" ? "working…" : step.desc)}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={cn("mx-1 size-4 shrink-0", active !== null && i < active ? "text-primary" : "text-border-strong")} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <SyncCtx.Provider value={{ run, running }}>
      {children}
      {mounted && open && createPortal(modal, document.body)}
    </SyncCtx.Provider>
  );
}
