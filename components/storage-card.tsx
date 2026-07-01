"use client";

import { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Usage {
  usedMb: number;
  limitMb: number;
  remainingMb: number;
  percent: number;
  tables: { name: string; mb: number }[];
}

const fmt = (mb: number) => (mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`);

export function StorageCard() {
  const [u, setU] = useState<Usage | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/db-usage")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(true) : setU(j)))
      .catch(() => setErr(true));
  }, []);

  const tone =
    u && u.percent >= 90 ? "danger" : u && u.percent >= 70 ? "warning" : "success";
  const barColor =
    tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success";
  const textColor =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" /> Database storage
        </CardTitle>
      </CardHeader>
      <CardContent>
        {err ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t read storage usage right now.</p>
        ) : !u ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold tracking-tight">{fmt(u.usedMb)}</div>
                <div className="text-xs text-muted-foreground">of {u.limitMb} MB used</div>
              </div>
              <div className="text-right">
                <div className={cn("text-lg font-semibold", textColor)}>{fmt(u.remainingMb)}</div>
                <div className="text-xs text-muted-foreground">free</div>
              </div>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${Math.max(u.percent, 1.5)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{u.percent.toFixed(1)}% used</span>
              <span>Supabase plan · {u.limitMb} MB</span>
            </div>

            {u.tables.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Largest tables</div>
                <ul className="space-y-1.5">
                  {u.tables.slice(0, 5).map((t) => (
                    <li key={t.name} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{t.name}</span>
                      <span className="font-medium">{fmt(t.mb)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
