import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseStatementText, type StatementLine } from "@/lib/statement";
// @ts-expect-error - pdf-parse lib path has no type declarations
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";
export const maxDuration = 60;

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 9999;
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

// POST { data: <dataURL|text>, mime? } → parsed statement lines matched to payments.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.data) return NextResponse.json({ error: "No file/text provided." }, { status: 400 });

    // Get raw text: PDF → extract, otherwise treat as plain text/CSV.
    let text = "";
    const m = String(b.data).match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (m && /pdf/i.test(m[1])) {
      const buf = Buffer.from(m[2], "base64");
      const out = await pdfParse(buf);
      text = out.text || "";
    } else if (m) {
      text = Buffer.from(m[2], "base64").toString("utf8");
    } else {
      text = String(b.data);
    }
    if (!text.trim()) return NextResponse.json({ error: "Couldn't read any text from the file." }, { status: 400 });

    const lines = await parseStatementText(text);

    // Candidate payments to reconcile against.
    const payments = (await sql`
      select id, payee, amount, paid_on, utr, reference, reconciled
      from payments order by paid_on desc nulls last, created_at desc limit 500
    `) as unknown as { id: string; payee: string | null; amount: string | null; paid_on: string | null; utr: string | null; reference: string | null; reconciled: boolean }[];

    const used = new Set<string>();
    const result = lines.map((l: StatementLine) => {
      let match: { id: string; payee: string | null; score: number } | null = null;
      if (l.direction === "debit" && l.amount != null) {
        for (const p of payments) {
          if (used.has(p.id) || p.amount == null) continue;
          if (Math.abs(Number(p.amount) - l.amount) > 1) continue;
          const refHit = !!l.ref && (l.ref === p.utr || l.ref === p.reference);
          const dayGap = daysBetween(l.date, p.paid_on);
          if (refHit || dayGap <= 5) {
            const score = refHit ? 100 : dayGap <= 1 ? 90 : 75;
            if (!match || score > match.score) match = { id: p.id, payee: p.payee, score };
          }
        }
      }
      if (match) used.add(match.id);
      return { ...l, matchPaymentId: match?.id ?? null, matchPayee: match?.payee ?? null, matchScore: match?.score ?? null };
    });

    const matched = result.filter((r) => r.matchPaymentId).length;
    const unmatchedDebits = result.filter((r) => r.direction === "debit" && !r.matchPaymentId).length;
    return NextResponse.json({ lines: result, matched, unmatchedDebits, total: result.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reconcile failed." }, { status: 500 });
  }
}
