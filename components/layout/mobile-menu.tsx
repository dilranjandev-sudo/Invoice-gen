"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Wallet, LogOut } from "lucide-react";
import { sections } from "./sidebar";
import { cn } from "@/lib/utils";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  useEffect(() => setMounted(true), []);

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
      .then((j) => setReviewCount(j?.payments?.needs_action ?? j?.payments?.matched ?? 0))
      .catch(() => {});
  }, [pathname]);

  const drawer = (
    // Rendered on <body> (via portal) so no backdrop-filter ancestor traps the
    // fixed positioning — this makes it cover the whole screen properly.
    <div className={cn("fixed inset-0 z-[60] md:hidden", open ? "pointer-events-auto" : "pointer-events-none")}>
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "absolute inset-0 bg-slate-900/50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full w-[80%] max-w-xs flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-strong px-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-white">
              <Wallet className="size-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight text-foreground">PayRecord</div>
              <div className="text-[10px] text-muted-foreground">Accounts Payable</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-surface-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const showBadge = "review" in item && item.review && reviewCount > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md py-1.5 pl-1.5 pr-2.5 text-[14px] font-medium transition-colors",
                          active
                            ? "bg-primary-soft text-primary"
                            : "text-[#5a5b5b] hover:bg-primary-soft hover:text-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-md transition-colors",
                            active
                              ? "bg-primary text-white"
                              : "bg-[var(--menu-icon-bg)] text-[#5a5b5b] group-hover:bg-primary group-hover:text-white"
                          )}
                        >
                          <Icon className="size-[17px]" />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">
                            {reviewCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <button
            onClick={() => router.push("/login")}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <LogOut className="size-[18px]" /> Log out
          </button>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted md:hidden"
      >
        <Menu className="size-5" />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
