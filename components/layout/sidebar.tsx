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
  LayoutDashboard,
  Receipt,
  Building2,
  ShoppingCart,
  CalendarClock,
  Sparkles,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Top-level menu groups → each is a parent with an icon and a submenu of items.
export const sections = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Home", icon: Home },
      { href: "/copilot", label: "Ask AI", icon: Sparkles },
      { href: "/cashflow", label: "Cash Flow", icon: TrendingDown },
      { href: "/workflow", label: "Workflow", icon: Workflow },
    ],
  },
  {
    label: "Payables",
    icon: Receipt,
    items: [
      { href: "/review", label: "To Review", icon: ClipboardCheck, review: true },
      { href: "/invoices", label: "Bills", icon: FileText },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/reconcile", label: "Reconcile", icon: Landmark },
      { href: "/purchasing", label: "Purchase Orders", icon: ShoppingCart },
      { href: "/vendors", label: "Vendors", icon: Users },
    ],
  },
  {
    label: "Sales",
    icon: ScrollText,
    items: [{ href: "/quotations", label: "Quotations", icon: ScrollText }],
  },
  {
    label: "Tax",
    icon: Percent,
    items: [
      { href: "/gst", label: "GST", icon: Percent },
      { href: "/tds", label: "TDS", icon: Scale },
    ],
  },
  {
    label: "Company",
    icon: Building2,
    items: [
      { href: "/recurring", label: "Recurring", icon: CalendarClock },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/documents", label: "Documents", icon: FolderClosed },
    ],
  },
  {
    label: "Setup",
    icon: Settings,
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
  function toggleSec(label: string, defaultOpen: boolean) {
    setOpenSecs((prev) => {
      const current = prev[label] ?? defaultOpen;
      const next = { ...prev, [label]: !current };
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

      {!collapsed && (
        <div className="px-4 pt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">Main Menu</div>
      )}

      <nav className={cn("flex-1 space-y-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {sections.map((group) => {
          const Parent = group.icon;
          const single = group.items.length === 1;
          const parentActive = group.items.some((it) => isActive(it.href));
          const open = openSecs[group.label] ?? parentActive;
          const groupBadge = group.items.some((it) => "review" in it && it.review) && reviewCount > 0;

          /* ---- Collapsed icon rail ---- */
          if (collapsed) {
            return (
              <Link
                key={group.label}
                href={group.items[0].href}
                title={group.label}
                className="group relative flex justify-center rounded-md p-1"
              >
                <span
                  className={cn(
                    "relative grid size-8 place-items-center rounded-md transition-colors",
                    parentActive ? "bg-primary text-white" : "bg-[var(--menu-icon-bg)] text-[#5a5b5b] group-hover:bg-primary group-hover:text-white"
                  )}
                >
                  <Parent className="size-[17px]" />
                  {groupBadge && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface" />}
                </span>
              </Link>
            );
          }

          /* ---- Single-item group → direct link ---- */
          if (single) {
            const it = group.items[0];
            const active = isActive(it.href);
            return (
              <Link
                key={group.label}
                href={it.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-[#5a5b5b] hover:bg-primary-soft hover:text-primary"
                )}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-md transition-colors", active ? "bg-primary text-white" : "bg-[var(--menu-icon-bg)] text-[#5a5b5b] group-hover:bg-primary group-hover:text-white")}>
                  <Parent className="size-4" />
                </span>
                <span className="flex-1">{group.label}</span>
              </Link>
            );
          }

          /* ---- Parent with submenu ---- */
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleSec(group.label, parentActive)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-md py-1 pl-1 pr-2.5 text-[13.5px] font-medium transition-colors",
                  parentActive ? "text-primary" : "text-[#5a5b5b] hover:text-primary"
                )}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-md transition-colors", parentActive ? "bg-primary text-white" : "bg-[var(--menu-icon-bg)] text-[#5a5b5b] group-hover:bg-primary group-hover:text-white")}>
                  <Parent className="size-4" />
                </span>
                <span className="flex-1 text-left">{group.label}</span>
                {groupBadge && !open && (
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">{reviewCount}</span>
                )}
                <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
              </button>

              {open && (
                <div className="relative mb-1 mt-0.5">
                  <span className="absolute bottom-1.5 left-[18px] top-1 w-px bg-border" />
                  <ul>
                    {group.items.map((it) => {
                      const active = isActive(it.href);
                      const showBadge = "review" in it && it.review && reviewCount > 0;
                      return (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            className={cn(
                              "group relative flex items-center gap-2 rounded-md py-1.5 pl-[34px] pr-2.5 text-[13px] font-medium transition-colors",
                              active ? "text-primary" : "text-[#5a5b5b] hover:text-primary"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute left-[15px] size-[7px] rounded-full ring-2 ring-surface transition-colors",
                                active ? "bg-primary" : "bg-border-strong group-hover:bg-primary"
                              )}
                            />
                            <span className="flex-1">{it.label}</span>
                            {showBadge && (
                              <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">{reviewCount}</span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
