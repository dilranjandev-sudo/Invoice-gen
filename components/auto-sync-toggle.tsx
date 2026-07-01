"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AutoSyncToggle() {
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setOn(s?.auto_sync_enabled !== "false"))
      .catch(() => setOn(true));
  }, []);

  async function toggle() {
    const next = !on;
    setOn(next);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "auto_sync_enabled", value: next ? "true" : "false" }),
      });
      toast.success(next ? "Auto-sync turned on" : "Auto-sync turned off");
    } catch {
      toast.error("Couldn't save");
      setOn(!next);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="size-4 text-muted-foreground" /> Automation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">Auto-sync from Gmail</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Automatically pull payments &amp; bills every 5 minutes while the app is open. Turn off to sync only
            manually (Dashboard / Gmail / Workflow).
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={on === null}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
            on ? "bg-primary" : "bg-border-strong"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
              on ? "left-[1.375rem]" : "left-0.5"
            )}
          />
        </button>
      </CardContent>
    </Card>
  );
}
