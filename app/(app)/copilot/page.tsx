"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

interface Msg { role: "user" | "ai"; text: string }

const SUGGESTIONS = [
  "How much did we pay this month?",
  "Which bills are unpaid?",
  "Who do we owe the most?",
  "What's due in the next week?",
  "How many payments need review?",
];

export default function CopilotPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch("/api/copilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "ai", text: j.error ? `⚠️ ${j.error}` : j.answer }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "⚠️ Something went wrong — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <PageHeader title="Ask AI" description="Ask about your bills, payments, vendors and dues in plain English." />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="size-6" /></div>
              <div className="mt-3 text-base font-semibold text-foreground">Your finance assistant</div>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Ask anything about your payables — it reads your live data.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:bg-primary-soft/40 hover:text-primary">{s}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2.5"}>
              {m.role === "ai" && <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-white"><Sparkles className="size-4" /></span>}
              <div className={m.role === "user"
                ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-white"
                : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border bg-surface-muted/50 px-4 py-2.5 text-sm text-foreground"}>
                {m.text}
              </div>
              {m.role === "user" && <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground"><User className="size-4" /></span>}
            </div>
          ))}

          {busy && (
            <div className="flex gap-2.5">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-white"><Sparkles className="size-4" /></span>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-surface-muted/50 px-4 py-2.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about your finances…"
            className="h-11 flex-1 rounded-xl border border-border-strong bg-surface px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary"
          />
          <button type="submit" disabled={busy || !q.trim()} className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
