"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AutopilotToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [threshold, setThreshold] = useState("95");
  const [remind, setRemind] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setOn(s?.autopilot_enabled === "true");
        if (s?.autopilot_threshold) setThreshold(String(s.autopilot_threshold));
        setRemind(s?.recurring_reminders_enabled !== "false");
      })
      .catch(() => setOn(false));
  }, []);

  async function put(key: string, value: string) {
    try {
      await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, value }) });
    } catch {
      toast.error("Couldn't save");
    }
  }

  async function toggle() {
    const next = !on;
    setOn(next);
    await put("autopilot_enabled", next ? "true" : "false");
    toast.success(next ? "Autopilot on — safe matches will auto-approve" : "Autopilot off");
  }
  async function toggleRemind() {
    const next = !remind;
    setRemind(next);
    await put("recurring_reminders_enabled", next ? "true" : "false");
    toast.success(next ? "Recurring reminders on" : "Recurring reminders off");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI Automation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Autopilot */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Autopilot</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Auto-approve payments matched at/above the confidence below — but only when the bill has no red-flag anomaly. Everything else still waits for you.
            </div>
          </div>
          <button onClick={toggle} disabled={on === null} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-primary" : "bg-border-strong")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
          </button>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/40 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-muted-foreground" /> Auto-approve at or above</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number" min={80} max={100} value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={(e) => { let n = Math.round(Number(e.target.value)); if (!Number.isFinite(n) || n < 80) n = 95; if (n > 100) n = 100; setThreshold(String(n)); put("autopilot_threshold", String(n)); toast.success("Threshold saved"); }}
              className="h-8 w-16 rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm text-muted-foreground">% match</span>
          </span>
        </label>

        <div className="border-t border-border" />

        {/* Recurring reminders */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium">Recurring reminder emails</div>
            <div className="mt-0.5 text-xs text-muted-foreground">A once-a-day email digest of rent/subscriptions due within 7 days (or overdue).</div>
          </div>
          <button onClick={toggleRemind} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", remind ? "bg-primary" : "bg-border-strong")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all", remind ? "left-[1.375rem]" : "left-0.5")} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
