"use client";

import { useState } from "react";
import {
  UploadCloud,
  Star,
  MoreHorizontal,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIco,
  Files,
  Share2,
  Clock,
  Star as StarIcon,
  Image as ImageIco,
  ChevronDown,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FileType = "doc" | "pdf" | "image" | "sheet" | "folder";

const fileMeta: Record<FileType, { icon: React.ElementType; wrap: string; color: string }> = {
  doc: { icon: FileText, wrap: "bg-blue-50", color: "text-blue-600" },
  pdf: { icon: FileIco, wrap: "bg-red-50", color: "text-red-600" },
  image: { icon: FileImage, wrap: "bg-violet-50", color: "text-violet-600" },
  sheet: { icon: FileSpreadsheet, wrap: "bg-emerald-50", color: "text-emerald-600" },
  folder: { icon: Folder, wrap: "bg-amber-50", color: "text-amber-500" },
};

const quickAccess = [
  { name: "Invoice-1021.pdf", type: "pdf" as FileType, size: "182 KB", fav: true },
  { name: "Vendor-Agreement.doc", type: "doc" as FileType, size: "1.2 MB", fav: true },
  { name: "Axis-Statement.pdf", type: "pdf" as FileType, size: "640 KB", fav: false },
  { name: "Expenses-Q2.xlsx", type: "sheet" as FileType, size: "320 KB", fav: true },
  { name: "Receipt-Scan.png", type: "image" as FileType, size: "880 KB", fav: false },
  { name: "Contracts", type: "folder" as FileType, size: "2.4 GB", fav: true },
];

const folders = [
  { name: "Invoices", size: "2.4 GB", files: 142 },
  { name: "Bank Statements", size: "1.1 GB", files: 38 },
  { name: "Receipts", size: "1.4 GB", files: 115 },
];

const categories = [
  { label: "All Files", icon: Files },
  { label: "Documents", icon: FileText },
  { label: "Invoices", icon: FileIco },
  { label: "Shared with Me", icon: Share2 },
  { label: "Recent", icon: Clock },
  { label: "Important", icon: StarIcon },
  { label: "Media", icon: ImageIco },
];

export default function DocsPage() {
  const [active, setActive] = useState("All Files");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      {/* Left panel */}
      <div className="space-y-4">
        <Card className="p-4">
          <button
            onClick={() => toast.success("Select files to upload")}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-white">
              <UploadCloud className="size-5" />
            </span>
            <span className="mt-1 text-sm font-semibold">Drop files here</span>
            <span className="text-xs text-muted-foreground">Select files to upload</span>
          </button>
        </Card>

        <Card className="p-2">
          <nav className="space-y-0.5">
            {categories.map((c) => {
              const Icon = c.icon;
              const on = active === c.label;
              return (
                <button
                  key={c.label}
                  onClick={() => setActive(c.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    on
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {c.label}
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Storage usage */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HardDrive className="size-4 text-muted-foreground" /> Storage
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-[37%] rounded-full bg-primary" />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">18.6 GB</span> of 50 GB used
          </div>
        </Card>
      </div>

      {/* Main */}
      <div className="space-y-8">
        {/* Quick access */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Quick Access</h2>
            <button className="text-sm font-medium text-primary hover:underline">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {quickAccess.map((f) => {
              const m = fileMeta[f.type];
              const Icon = m.icon;
              return (
                <Card
                  key={f.name}
                  className="group relative flex cursor-pointer flex-col items-center px-3 py-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-card-lg"
                >
                  <button className="absolute right-2.5 top-2.5 text-muted-foreground/50 hover:text-amber-400">
                    <Star className={cn("size-4", f.fav && "fill-amber-400 text-amber-400")} />
                  </button>
                  <div className={cn("grid size-14 place-items-center rounded-xl", m.wrap)}>
                    <Icon className={cn("size-7", m.color)} />
                  </div>
                  <div className="mt-3 w-full truncate text-sm font-medium">{f.name}</div>
                  <span className="mt-2 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                    {f.size}
                  </span>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Recent folders */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Folders</h2>
            <button className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted">
              Last 7 Days <ChevronDown className="size-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {folders.map((f) => (
              <Card
                key={f.name}
                className="flex cursor-pointer items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-lg"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500">
                  <Folder className="size-6 fill-amber-400/30" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.size} · {f.files} files
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-white">
                    A
                  </div>
                  <button
                    onClick={() => toast("Folder options")}
                    className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-surface-muted"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
