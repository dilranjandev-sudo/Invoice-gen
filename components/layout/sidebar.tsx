"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  User,
  Building2,
  KeyRound,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const sections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: Home },
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
      { href: "/gst", label: "GST", icon: Percent },
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

      <ProfileMenu />
    </aside>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = [
    { label: "Profile Settings", icon: User, onClick: () => toast("Opening profile settings") },
    { label: "Company Settings", icon: Building2, href: "/settings" },
    { label: "Change Password", icon: KeyRound, onClick: () => toast("Opening password change") },
  ];

  return (
    <div ref={ref} className="relative border-t border-border p-3">
      {open && (
        <div className="absolute bottom-[calc(100%-0.25rem)] left-3 right-3 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-3 py-2.5">
            <div className="text-sm font-medium">Admin User</div>
            <div className="text-xs text-muted-foreground">admin@biqadx.com</div>
          </div>
          <div className="p-1">
            {items.map((it) => {
              const Icon = it.icon;
              const cls =
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-surface-muted";
              return it.href ? (
                <Link key={it.label} href={it.href} className={cls} onClick={() => setOpen(false)}>
                  <Icon className="size-4 text-muted-foreground" /> {it.label}
                </Link>
              ) : (
                <button key={it.label} className={cls} onClick={() => { it.onClick?.(); setOpen(false); }}>
                  <Icon className="size-4 text-muted-foreground" /> {it.label}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={() => router.push("/login")}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-primary hover:bg-primary-soft"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors",
          open ? "bg-surface-muted" : "hover:bg-surface-muted"
        )}
      >
        <div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          A
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-foreground">Admin User</div>
          <div className="truncate text-xs text-muted-foreground">Administrator</div>
        </div>
        <ChevronUp className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}
