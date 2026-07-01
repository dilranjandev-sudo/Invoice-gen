"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Wallet } from "lucide-react";
import { sections } from "./sidebar";
import { cn } from "@/lib/utils";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => setReviewCount(j?.payments?.matched ?? 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted md:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className={cn("fixed inset-0 z-50 md:hidden", open ? "pointer-events-auto" : "pointer-events-none")}>
        {/* Overlay */}
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-slate-900/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        {/* Drawer */}
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-surface shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Wallet className="size-5" />
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-tight">PayRecord</div>
                <div className="text-[11px] text-muted-foreground">Accounts Payable</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const showBadge = "review" in item && item.review && reviewCount > 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary-soft text-primary"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
                        <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            {reviewCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
