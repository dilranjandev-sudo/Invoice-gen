import { cn } from "@/lib/utils";

/** A shimmering placeholder block. Use while data is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}

/** Placeholder for a data table while it loads. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border bg-surface-muted/50 px-5 py-3.5">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="hidden h-3.5 w-20 sm:block" />
            <Skeleton className="hidden h-3.5 w-16 md:block" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder row of summary/stat cards. */
export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", count === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-card">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic list-page skeleton: optional stat cards + a table. */
export function ListPageSkeleton({ cards = 3, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-5">
      {cards > 0 && <StatCardsSkeleton count={cards} />}
      <TableSkeleton rows={rows} />
    </div>
  );
}
