import { cn } from "@/lib/utils";

/** A shimmering placeholder block. Use while data is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}
