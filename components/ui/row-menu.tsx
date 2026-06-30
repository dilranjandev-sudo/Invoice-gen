"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RowMenu({
  onEdit,
  onDelete,
  label = "this item",
}: {
  onEdit?: () => void;
  onDelete: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.right - 144 });
    setOpen(true);
  }

  function confirmDelete() {
    setOpen(false);
    toast(`Delete ${label}?`, {
      action: { label: "Delete", onClick: onDelete },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface-muted"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-50 w-36 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {onEdit && (
            <button
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted"
            >
              <Pencil className="size-4 text-muted-foreground" /> Edit
            </button>
          )}
          <button
            onClick={confirmDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      )}
    </>
  );
}
