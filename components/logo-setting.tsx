"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LogoSetting() {
  const [hasLogo, setHasLogo] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0); // cache-buster
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = hasLogo === null;

  useEffect(() => {
    fetch("/api/logo", { method: "GET" })
      .then((r) => setHasLogo(r.ok))
      .catch(() => setHasLogo(false));
  }, []);

  async function save(dataUrl: string) {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "company_logo", value: dataUrl }),
      });
      if (!r.ok) throw new Error();
      setHasLogo(!!dataUrl);
      setVersion((v) => v + 1);
      toast.success(dataUrl ? "Logo saved — it'll appear in vendor emails" : "Logo removed");
    } catch {
      toast.error("Couldn't save logo");
    } finally {
      setSaving(false);
    }
  }

  function onFile(file: File) {
    if (!/^image\//.test(file.type)) return toast.error("Please pick an image (PNG/JPG/SVG).");
    if (file.size > 600 * 1024) return toast.error("Logo too large — keep it under 600 KB.");
    const reader = new FileReader();
    reader.onload = () => save(String(reader.result));
    reader.onerror = () => toast.error("Couldn't read the file.");
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="size-4 text-muted-foreground" /> Company logo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Shown at the top of the payment-confirmation email sent to vendors. PNG with a transparent background works
          best.
        </p>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-40 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-muted/40">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/logo?v=${version}`} alt="Logo" className="max-h-14 max-w-[9rem] object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" disabled={saving} onClick={() => inputRef.current?.click()}>
              <ImagePlus className="size-4" /> {hasLogo ? "Replace logo" : "Upload logo"}
            </Button>
            {hasLogo && (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                className="text-danger hover:bg-danger-soft"
                onClick={() => save("")}
              >
                <Trash2 className="size-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
