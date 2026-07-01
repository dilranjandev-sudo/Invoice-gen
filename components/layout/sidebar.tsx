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
    label: "Accounts payable",
    items: [
      { href: "/review", label: "To Review", icon: ClipboardCheck, review: true },
      { href: "/invoices", label: "Bills", icon: FileText },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/vendors", label: "Vendors", icon: Users },
    ],
  },
  {
    label: "Tax & Compliance",
    items: [
      { href: "/gst", label: "GST", icon: Percent },
      { href: "/tds", label: "TDS", icon: Scale },
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
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    function load() {
      fetch("/api/stats")
        .then((r) => r.json())
        .then((j) => setReviewCount(j?.payments?.matched ?? 0))
        .catch(() => {});
    }
    load();
    window.addEventListener("payrecord:synced", load);
    return () => window.removeEventListener("payrecord:synced", load);
  }, [pathname]);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Wallet className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-foreground">PayRecord</div>
          <div className="text-[11px] text-muted-foreground">Accounts Payable</div>
        </div>
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
                const showBadge = item.review && reviewCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
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
  );
}

