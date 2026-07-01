"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Inbox,
  Sparkles,
  GitCompareArrows,
  ClipboardCheck,
  Send,
  ArrowRight,
  ArrowDown,
  Play,
  Loader2,
  Check,
  Hand,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

type NodeStatus = "idle" | "running" | "done";

interface Live {
  accounts: number;
  bills: number;
  payments: number;
  matched: number;
  awaiting: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STEPS = [
  { key: "gmail", title: "Gmail", desc: "Trigger", icon: Mail },
  { key: "payments", title: "Read payments", desc: "Fetch + AI", icon: Inbox },
  { key: "bills", title: "Read bills", desc: "PDF + AI + rules", icon: Sparkles },
  { key: "match", title: "Auto-match", desc: "Bill ↔ payment", icon: GitCompareArrows },
  { key: "review", title: "Review & approve", desc: "You", icon: ClipboardCheck, manual: true },
  { key: "notify", title: "Notify vendor", desc: "Send email", icon: Send },
] as const;

export default function WorkflowPage() {
  const [live, setLive] = useState<Live | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [stats, acc] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/gmail/accounts").then((r) => r.json()),
      ]);
      setLive({
        accounts: Array.isArray(acc) ? acc.length : 0,
        bills: stats?.invoices?.n ?? 0,
        payments: stats?.payments?.n ?? 0,
        matched: (stats?.payments?.matched ?? 0) + (stats?.payments?.approved ?? 0),
        awaiting: stats?.payments?.matched ?? 0,
      });
    } catch {
      setLive({ accounts: 0, bills: 0, payments: 0, matched: 0, awaiting: 0 });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function statusOf(i: number, key: string): NodeStatus {
    if (i === active) return "running";
    if (results[key] != null) return "done";
    return "idle";
  }

  // Live subtitle when idle; real run-result once a step has run.
  function sub(key: string): string {
    if (results[key] != null) return results[key];
    if (!live) return "—";
    switch (key) {
      case "gmail":
        return `${live.accounts} account${live.accounts === 1 ? "" : "s"} connected`;
      case "payments":
        return `${live.payments} payment${live.payments === 1 ? "" : "s"} on file`;
      case "bills":
        return `${live.bills} bill${live.bills === 1 ? "" : "s"} on file`;
      case "match":
        return `${live.matched} matched`;
      case "review":
        return `${live.awaiting} awaiting`;
      case "notify":
        return "On approval";
      default:
        return "";
    }
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setResults({});

    try {
      // 1 — Gmail (real: how many accounts are connected)
      setActive(0);
      const acc = await fetch("/api/gmail/accounts").then((r) => r.json());
      const nAcc = Array.isArray(acc) ? acc.length : 0;
      setResults((r) => ({ ...r, gmail: `${nAcc} account${nAcc === 1 ? "" : "s"}` }));
      if (nAcc === 0) {
        toast.error("No Gmail connected — connect one first.");
        setActive(null);
        setRunning(false);
        return;
      }
      await sleep(250);

      // 2 — Read payments (real API)
      setActive(1);
      const p = await fetch("/api/gmail/sync", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({
        ...r,
        payments: p.rateLimited ? `${p.synced ?? 0} new · AI busy` : `${p.synced ?? 0} new · ${p.scanned ?? 0} read`,
      }));

      // 3 — Read bills (real API — includes the rules engine)
      setActive(2);
      const b = await fetch("/api/gmail/import-bills", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({
        ...r,
        bills: b.rateLimited ? `${b.imported ?? 0} in · AI busy` : `${b.imported ?? 0} imported · ${b.scanned ?? 0} read`,
      }));

      // 4 — Auto-match (real API)
      setActive(3);
      const m = await fetch("/api/match", { method: "POST" }).then((r) => r.json());
      setResults((r) => ({ ...r, match: `${m.matched ?? 0} matched` }));

      // 5 — Review (real count awaiting)
      setActive(4);
      const stats = await fetch("/api/stats").then((r) => r.json());
      const awaiting = stats?.payments?.matched ?? 0;
      setResults((r) => ({ ...r, review: `${awaiting} awaiting you` }));

      // 6 — Notify (happens on approval)
      setActive(5);
      setResults((r) => ({ ...r, notify: "Sent on approval" }));
      await sleep(300);

      setActive(null);
      setLastRun(
        `${p.synced ?? 0} payment(s) · ${b.imported ?? 0} bill(s) · ${m.matched ?? 0} matched` +
          (p.rateLimited || b.rateLimited ? " · paused (AI busy)" : "")
      );
      const parts = [];
      if (p.synced) parts.push(`${p.synced} payment${p.synced === 1 ? "" : "s"}`);
      if (b.imported) parts.push(`${b.imported} bill${b.imported === 1 ? "" : "s"}`);
      toast.success(parts.length ? `Workflow ran — ${parts.join(" · ")}` : "Workflow ran — nothing new");
      window.dispatchEvent(new Event("payrecord:synced"));
      load();
    } catch {
      toast.error("Workflow failed");
      setActive(null);
    }
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow"
        description="Run it and watch each step happen for real — every node lights up as its actual work completes."
        actions={
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Running…" : "Run workflow"}
          </Button>
        }
      />

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border bg-surface px-5 py-3 text-sm shadow-card">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", running ? "animate-pulse bg-warning" : "bg-success")} />
          {running ? "Running now" : "Idle — auto-runs every 5 min (toggle in Settings)"}
        </span>
        {lastRun && <span className="text-muted-foreground">Last run: {lastRun}</span>}
      </div>

      {/* Flow */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-start lg:justify-between">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex flex-col items-center lg:flex-1 lg:flex-row">
              <WorkflowNode step={step} status={statusOf(i, step.key)} sub={sub(step.key)} />
              {i < STEPS.length - 1 && <Connector active={active !== null && i < active} />}
            </div>
          ))}
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          <Hand className="mr-1 inline size-3.5 align-[-2px] text-warning" />
          Only <span className="font-medium text-foreground">Review &amp; approve</span> needs you. Bills also pass the{" "}
          <span className="font-medium text-foreground">rules</span> check before they&apos;re saved.
        </p>
      </div>
    </div>
  );
}

function WorkflowNode({
  step,
  status,
  sub,
}: {
  step: { title: string; desc: string; icon: React.ComponentType<{ className?: string }>; manual?: boolean };
  status: NodeStatus;
  sub: string;
}) {
  const Icon = step.icon;
  const ring =
    status === "running"
      ? "border-primary ring-2 ring-ring"
      : status === "done"
        ? "border-success/50"
        : step.manual
          ? "border-warning/40"
          : "border-border";
  const iconWrap =
    status === "running"
      ? "bg-primary text-primary-foreground"
      : status === "done"
        ? "bg-success-soft text-success"
        : step.manual
          ? "bg-warning-soft text-warning"
          : "bg-surface-muted text-muted-foreground";

  return (
    <div className={cn("relative w-full max-w-[200px] rounded-md border bg-surface p-4 text-center shadow-sm transition-colors lg:max-w-none", ring)}>
      <div className="absolute right-2 top-2">
        {status === "running" ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : status === "done" ? (
          <Check className="size-4 text-success" />
        ) : step.manual ? (
          <Hand className="size-3.5 text-warning" />
        ) : null}
      </div>

      <div className={cn("mx-auto grid size-11 place-items-center rounded-lg transition-colors", iconWrap)}>
        <Icon className="size-5" />
      </div>
      <div className="mt-2.5 text-sm font-semibold">{step.title}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{step.desc}</div>
      <div className={cn("mt-1 text-xs", status === "done" ? "font-medium text-foreground" : "text-muted-foreground")}>{sub}</div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <>
      <div className="flex h-6 items-center justify-center lg:hidden">
        <ArrowDown className={cn("size-4", active ? "text-primary" : "text-border-strong")} />
      </div>
      <div className="hidden items-center lg:flex lg:flex-1">
        <div className={cn("h-px flex-1", active ? "bg-primary" : "bg-border-strong")} />
        <ArrowRight className={cn("size-4 shrink-0", active ? "text-primary" : "text-border-strong")} />
      </div>
    </>
  );
}
