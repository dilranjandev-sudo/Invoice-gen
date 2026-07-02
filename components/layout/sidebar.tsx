"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardCheck,
  FileText,
  CreditCard,
  Users,
  Mail,
  Settings,
  Wallet,
  Workflow,
  ShieldCheck,
  Percent,
  TrendingDown,
  Scale,
  ScrollText,
  Repeat,
  FolderClosed,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const sections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: Home },
      { href: "/cashflow", label: "Cash Flow", icon: TrendingDown },
      { href: "/workflow", label: "Workflow", icon: Workflow },
    ],
  },
  {
    label: "Payables",
    items: [
      { href: "/review", label: "To Review", icon: ClipboardCheck, review: true },
      { href: "/invoices", label: "Bills", icon: FileText },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/vendors", label: "Vendors", icon: Users },
    ],
  },
  {
    label: "Sales",
    items: [{ href: "/quotations", label: "Quotations", icon: ScrollText }],
  },
  {
    label: "Tax",
    items: [
      { href: "/gst", label: "GST", icon: Percent },
      { href: "/tds", label: "TDS", icon: Scale },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/documents", label: "Documents", icon: FolderClosed },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/connectors", label: "Gmail", icon: Mail },
      { href: "/rules", label: "Rules", icon: ShieldCheck },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [reviewCount, setReviewCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [openSecs, setOpenSecs] = useState<Record<string, boolean>>({});
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // A section is open unless it has been explicitly closed.
  const secOpen = (label: string) => openSecs[label] !== false;

  // Restore preferences.
  useEffect(() => {
    setCollapsed(localStorage.getItem("pr_sidebar_collapsed") === "1");
    try {
      const raw = localStorage.getItem("pr_sidebar_sections");
      if (raw) setOpenSecs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("pr_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }
  function toggleSec(label: string) {
    setOpenSecs((prev) => {
      const next = { ...prev, [label]: prev[label] === false };
      localStorage.setItem("pr_sidebar_sections", JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    function load() {
      fetch("/api/review-count")
        .then((r) => r.json())
        .then((j) => setReviewCount(j?.count ?? 0))
        .catch(() => {});
    }
    load();
    window.addEventListener("payrecord:synced", load);
    window.addEventListener("payrecord:changed", load);
    return () => {
      window.removeEventListener("payrecord:synced", load);
      window.removeEventListener("payrecord:changed", load);
    };
  }, []);

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 flex-col border-r border-border-strong bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Brand + collapse toggle */}
      <div className={cn("flex h-14 items-center border-b border-border-strong", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        {!collapsed && (
          <>
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-white">
              <Wallet className="size-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight text-foreground">PayRecord</div>
              <div className="text-[10px] text-muted-foreground">Accounts Payable</div>
            </div>
          </>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md border border-border-strong text-muted-foreground transition-colors hover:bg-primary hover:text-white",
            !collapsed && "ml-auto"
          )}
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className={cn("flex-1 space-y-3.5 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {sections.map((section) => {
          const open = collapsed || secOpen(section.label);
          return (
          <div key={section.label}>
            {collapsed ? (
              <div className="mx-auto mb-1.5 h-px w-6 bg-border" />
            ) : (
              <button
                onClick={() => toggleSec(section.label)}
                className="mb-1 flex w-full items-center justify-between rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                <span>{section.label}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
              </button>
            )}
            {open && (
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const showBadge = "review" in item && item.review && reviewCount > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center rounded-md text-[13.5px] font-medium transition-colors",
                        collapsed ? "justify-center p-1" : "gap-2.5 py-1 pl-1 pr-2.5",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-[#5a5b5b] hover:bg-primary-soft hover:text-primary"
                      )}
                    >
                      <span
                        className={cn(
                          "relative grid size-7 shrink-0 place-items-center rounded-md transition-colors",
                          active
                            ? "bg-primary text-white"
                            : "bg-[var(--menu-icon-bg)] text-[#5a5b5b] group-hover:bg-primary group-hover:text-white"
                        )}
                      >
                        <Icon className="size-4" />
                        {collapsed && showBadge && (
                          <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface" />
                        )}
                      </span>
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && showBadge && (
                        <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">
                          {reviewCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-border-strong px-4 py-3 text-[10.5px] text-muted-foreground">
          Biqadx Private Limited
        </div>
      )}
    </aside>
  );
}
