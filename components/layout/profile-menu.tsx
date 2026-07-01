"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Building2, KeyRound, LogOut, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfileMenu() {
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

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
  }

  const items = [
    { label: "Profile", icon: User, onClick: () => toast("Opening profile") },
    { label: "Company Settings", icon: Building2, href: "/settings" },
    { label: "Change Password", icon: KeyRound, onClick: () => toast("Password change coming soon") },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-surface-muted",
          open && "bg-surface-muted"
        )}
      >
        <div className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          A
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-sm font-medium text-foreground">Admin User</div>
          <div className="text-[11px] text-muted-foreground">Owner</div>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-56 overflow-hidden rounded-md border border-border bg-surface shadow-card-lg">
          <div className="border-b border-border px-3 py-2.5">
            <div className="text-sm font-medium">Admin User</div>
            <div className="text-xs text-muted-foreground">admin@biqadx.com</div>
          </div>
          <div className="p-1">
            {items.map((it) => {
              const Icon = it.icon;
              const cls =
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-surface-muted";
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
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger hover:bg-danger-soft"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
