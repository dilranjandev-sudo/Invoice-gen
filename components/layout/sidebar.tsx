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
    <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-border-strong bg-surface">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-strong px-4">
        <div className="grid size-8 place-items-center rounded-md bg-primary text-white">
          <Wallet className="size-[18px]" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-foreground">PayRecord</div>
          <div className="text-[10px] text-muted-foreground">Accounts Payable</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
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

      <div className="border-t border-border-strong px-4 py-3 text-[10.5px] text-muted-foreground">
        Biqadx Private Limited
      </div>
    </aside>
  );
}
