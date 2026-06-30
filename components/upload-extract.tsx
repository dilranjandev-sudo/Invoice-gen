"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExtractedInvoice } from "@/lib/invoice-types";

/** Upload-and-extract (default) vs manual-entry segmented toggle. */
export function ModeTabs({
  mode,
  onUpload,
  onManual,
}: {
  mode: "upload" | "manual";
  onUpload: () => void;
  onManual: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-strong p-1 text-sm">
      <button
        type="button"
        onClick={onUpload}
        className={cn(
          "rounded-md py-1.5 font-medium transition-colors",
          mode === "upload" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Upload &amp; Extract
      </button>
      <button
        type="button"
        onClick={onManual}
        className={cn(
          "rounded-md py-1.5 font-medium transition-colors",
          mode === "manual" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Manual Entry
      </button>
    </div>
  );
}

/**
 * Real upload → POST /api/extract → Gemini extracts the invoice → onExtracted(data).
 */
export function UploadExtract({
  onExtracted,
}: {
  onExtracted: (data: ExtractedInvoice, fileName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Extraction failed");
      onExtracted(json as ExtractedInvoice, file.name);
      toast.success("Invoice extracted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
      setBusy(false);
      setFileName(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-muted/30 px-6 py-14 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="mt-3 text-sm font-medium">Extracting details with AI…</p>
        <p className="mt-0.5 max-w-[14rem] truncate text-xs text-muted-foreground">
          {fileName}
        </p>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-muted/20 px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
      >
        <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
          <UploadCloud className="size-6" />
        </span>
        <p className="mt-3 text-sm font-medium">Drop a PDF or image here</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          or click to browse — AI will extract the details
        </p>
      </button>
    </>
  );
}
