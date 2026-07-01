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
  approved: number;
}

interface RunResult {
  scanned: number;
  imported: number;
  synced: number;
  matched: number;
  rateLimited: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function WorkflowPage() {
  const [live, setLive] = useState<Live | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsR, accR] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/gmail/accounts").then((r) => r.json()),
      ]);
      setLive({
        accounts: Array.isArray(accR) ? accR.length : 0,
        bills: statsR?.invoices?.n ?? 0,
        payments: statsR?.payments?.n ?? 0,
        matched: (statsR?.payments?.matched ?? 0) + (statsR?.payments?.approved ?? 0),
        awaiting: statsR?.payments?.matched ?? 0,
        approved: statsR?.payments?.approved ?? 0,
      });
    } catch {
      setLive({ accounts: 0, bills: 0, payments: 0, matched: 0, awaiting: 0, approved: 0 });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const steps = [
    { key: "trigger", title: "Gmail", desc: "Trigger", icon: Mail, sub: live ? `${live.accounts} account${live.accounts === 1 ? "" : "s"} connected` : "—" },
    { key: "fetch", title: "Fetch emails", desc: "Read inbox", icon: Inbox, sub: "Bills & payment emails" },
    { key: "extract", title: "AI extract", desc: "Read the data", icon: Sparkles, sub: live ? `${live.bills} bills · ${live.payments} payments` : "—" },
    { key: "match", title: "Auto-match", desc: "Bill ↔ payment", icon: GitCompareArrows, sub: live ? `${live.matched} matched` : "—" },
    { key: "review", title: "Review & approve", desc: "You", icon: ClipboardCheck, manual: true, sub: live ? `${live.awaiting} awaiting` : "—" },
    { key: "notify", title: "Notify vendor", desc: "Send email", icon: Send, sub: "On approval" },
  ];

  function statusOf(i: number): NodeStatus {
    if (active === null) return done ? "done" : "idle";
    if (i < active) return "done";
    if (i === active) return "running";
    return "idle";
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(false);
    setResult(null);

    // Kick off the real work while we animate the pipeline.
    const work = fetch("/api/gmail/sync-all", { method: "POST" })
      .then((r) => r.json())
      .catch(() => null);

    // Animate through the automated steps (skip the manual "review" node).
    for (let i = 0; i < steps.length; i++) {
      setActive(i);
      await sleep(650);
    }
    setActive(null);

    const j = await work;
    if (j && !j.error) {
      const res: RunResult = {
        scanned: (j.payments?.scanned ?? 0) + (j.bills?.scanned ?? 0),
        imported: j.bills?.imported ?? 0,
        synced: j.payments?.synced ?? 0,
        matched: j.matched ?? 0,
        rateLimited: !!j.rateLimited,
      };
      setResult(res);
      setDone(true);
      const parts = [];
      if (res.synced) parts.push(`${res.synced} payment${res.synced === 1 ? "" : "s"}`);
      if (res.imported) parts.push(`${res.imported} bill${res.imported === 1 ? "" : "s"}`);
      toast.success(parts.length ? `Workflow ran — ${parts.join(" · ")}` : "Workflow ran — nothing new");
      window.dispatchEvent(new Event("payrecord:synced"));
      load();
    } else {
      toast.error(j?.error || "Workflow failed");
    }
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow"
        description="This is how PayRecord turns your inbox into approved, recorded payments — automatically."
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
          {running ? "Running" : "Idle — runs automatically every 5 min"}
        </span>
        {result && (
          <span className="text-muted-foreground">
            Last run: {result.scanned} scanned · {result.synced + result.imported} new · {result.matched} matched
            {result.rateLimited && " · paused (AI busy)"}
          </span>
        )}
      </div>

      {/* Flow */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-card sm:p-8">
        <div className="flex flex-col items-stretch gap-0 lg:flex-row lg:items-start lg:justify-between">
          {steps.map((step, i) => {
            const st = statusOf(i);
            return (
              <div key={step.key} className="flex flex-col items-center lg:flex-1 lg:flex-row">
                <WorkflowNode step={step} status={st} />
                {i < steps.length - 1 && <Connector active={active !== null && i < active} />}
              </div>
            );
          })}
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          <Hand className="mr-1 inline size-3.5 align-[-2px] text-warning" />
          Only the <span className="font-medium text-foreground">Review &amp; approve</span> step needs you. Everything
          else runs on its own.
        </p>
      </div>
    </div>
  );
}

function WorkflowNode({
  step,
  status,
}: {
  step: { title: string; desc: string; sub: string; icon: React.ComponentType<{ className?: string }>; manual?: boolean };
  status: NodeStatus;
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
      {/* status corner */}
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
      <div className="mt-1 text-xs text-muted-foreground">{step.sub}</div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <>
      {/* vertical on mobile */}
      <div className="flex h-6 items-center justify-center lg:hidden">
        <ArrowDown className={cn("size-4", active ? "text-primary" : "text-border-strong")} />
      </div>
      {/* horizontal on desktop */}
      <div className="hidden items-center lg:flex lg:flex-1">
        <div className={cn("h-px flex-1", active ? "bg-primary" : "bg-border-strong")} />
        <ArrowRight className={cn("size-4 shrink-0", active ? "text-primary" : "text-border-strong")} />
      </div>
    </>
  );
}
