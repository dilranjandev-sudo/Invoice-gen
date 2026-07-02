"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, FileText, Users, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { MobileMenu } from "./mobile-menu";
import { ProfileMenu } from "./profile-menu";
import { useSync } from "@/components/sync-provider";
import { formatMoney, cn } from "@/lib/utils";

interface Result {
  type: string;
  title: string;
  sub: string | number | null;
  href: string;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Bill: FileText,
  Vendor: Users,
  Payment: CreditCard,
};

export function Topbar() {
  const router = useRouter();
  const { run: runSync, running: syncing } = useSync();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(Array.isArray(j.results) ? j.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border-strong bg-surface px-4 sm:gap-4 sm:px-5 lg:px-8">
      <MobileMenu />
      <div ref={boxRef} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search bills, vendors, payments…"
          className="h-9 w-full rounded-md border border-border-strong bg-surface-muted pl-10 pr-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-colors"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

        {open && q.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-md border border-border bg-surface shadow-card-lg">
            {results.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for “{q}”.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((r, i) => {
                  const Icon = TYPE_ICON[r.type] ?? FileText;
                  return (
                    <li key={i}>
                      <button
                        onClick={() => go(r.href)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block text-xs text-muted-foreground">{r.type}</span>
                        </span>
                        {typeof r.sub === "number" && (
                          <span className="shrink-0 text-sm font-medium tabular-nums">{formatMoney(r.sub)}</span>
                        )}
                        {typeof r.sub === "string" && (
                          <span className="shrink-0 truncate font-mono text-xs text-muted-foreground">{r.sub}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={runSync}
          disabled={syncing}
          className="hidden items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60 sm:inline-flex"
        >
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
        <button className="relative grid size-9 place-items-center rounded-md border border-border-strong bg-surface-muted text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary">
          <Bell className="size-[18px]" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}
