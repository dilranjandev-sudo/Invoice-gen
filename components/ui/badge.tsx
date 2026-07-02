import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "orange";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  orange: "bg-orange-soft text-orange",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/* ---- Status mappings -------------------------------------------------------- */

const RECORD_STATUS: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  matched: { tone: "success", label: "Matched" },
  approved: { tone: "success", label: "Approved" },
  expense: { tone: "info", label: "Expense" },
  unmatched: { tone: "warning", label: "Needs action" },
  paid: { tone: "success", label: "Paid" },
  no_match: { tone: "danger", label: "No Match" },
  multiple: { tone: "violet", label: "Multiple Matches" },
  needs_review: { tone: "warning", label: "Needs Review" },
  failed: { tone: "danger", label: "Failed" },
  rejected: { tone: "danger", label: "Rejected" },
  processing: { tone: "info", label: "Processing" },
  unread: { tone: "primary", label: "Unread" },
};

const CONNECTION_STATUS: Record<string, { tone: Tone; label: string }> = {
  connected: { tone: "success", label: "Connected" },
  disconnected: { tone: "danger", label: "Disconnected" },
  expired: { tone: "warning", label: "Auth Expired" },
  paused: { tone: "neutral", label: "Paused" },
  syncing: { tone: "info", label: "Syncing" },
};

export function StatusBadge({
  status,
  kind = "record",
}: {
  status: string;
  kind?: "record" | "connection";
}) {
  const map = kind === "connection" ? CONNECTION_STATUS : RECORD_STATUS;
  const cfg = map[status] ?? { tone: "neutral" as Tone, label: status };
  return (
    <Badge tone={cfg.tone}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </Badge>
  );
}

/** Solid, filled status pill (Paid / Partially Paid / Unpaid). */
const SOLID: Record<string, { bg: string; label: string }> = {
  paid: { bg: "bg-[#22c55e]", label: "Paid" },
  partial: { bg: "bg-[#f5a623]", label: "Partially Paid" },
  unpaid: { bg: "bg-[#ef4444]", label: "Unpaid" },
  overdue: { bg: "bg-[#ef4444]", label: "Overdue" },
  draft: { bg: "bg-[#94a3b8]", label: "Draft" },
};

export function PayPill({ status }: { status: string }) {
  const c = SOLID[status] ?? { bg: "bg-[#94a3b8]", label: status };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white", c.bg)}>
      {c.label}
    </span>
  );
}

/** Coloured percentage chip for AI match scores. */
export function MatchScore({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const tone: Tone = score >= 90 ? "success" : score >= 75 ? "warning" : "danger";
  return <Badge tone={tone}>{score}%</Badge>;
}
