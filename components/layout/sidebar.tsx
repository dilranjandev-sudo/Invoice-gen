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
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    function load() {
      fetch("/api/stats")
        .then((r) => r.json())
        .then((j) => setReviewCount(j?.payments?.needs_action ?? j?.payments?.matched ?? 0))
        .catch(() => {});
    }
    load();
    window.addEventListener("payrecord:synced", load);
    return () => window.removeEventListener("payrecord:synced", load);
  }, [pathname]);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Wallet className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-foreground">PayRecord</div>
          <div className="text-[11px] text-muted-foreground">Accounts Payable</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
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
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-primary-foreground" : "text-muted-foreground/80 group-hover:text-foreground")} />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span
                        className={cn(
                          "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
                          active ? "bg-white/25 text-primary-foreground" : "bg-primary text-primary-foreground"
                        )}
                      >
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
  );
}
