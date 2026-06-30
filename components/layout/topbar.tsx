"use client";

import { Search, Bell } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-surface px-5 lg:px-8">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search Keyword"
          className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-10 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          ⌘
        </kbd>
      </div>

      <button className="relative ml-auto grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-surface-muted">
        <Bell className="size-5" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />
      </button>
    </header>
  );
}
