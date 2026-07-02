import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Advance an ISO date by a frequency, returning a new ISO (yyyy-mm-dd).
function advance(dateIso: string, freq: string): string {
  const d = new Date(dateIso + "T00:00:00");
  if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  else if (freq === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (freq === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1); // monthly default
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const rows = await sql`select * from recurring_expenses order by active desc, next_due asc nulls last, created_at desc`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const [r] = await sql`
      insert into recurring_expenses (name, payee, category, amount, currency, frequency, next_due, notes, active)
      values (${str(b.name)}, ${str(b.payee)}, ${str(b.category)}, ${num(b.amount)}, ${str(b.currency) ?? "INR"}, ${str(b.frequency) ?? "monthly"}, ${str(b.nextDue)}, ${str(b.notes)}, ${b.active === false ? false : true})
      returning *
    `;
    return NextResponse.json(r);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    // Mark this cycle paid → roll next_due forward by the frequency.
    if (b.action === "paid") {
      const [row] = await sql`select next_due, frequency from recurring_expenses where id = ${b.id}`;
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const base = (row.next_due as string) || new Date().toISOString().slice(0, 10);
      const next = advance(String(base).slice(0, 10), (row.frequency as string) || "monthly");
      await sql`update recurring_expenses set last_paid_on = ${String(base).slice(0, 10)}, next_due = ${next} where id = ${b.id}`;
      return NextResponse.json({ ok: true, next_due: next });
    }

    await sql`
      update recurring_expenses set
        name = ${str(b.name)}, payee = ${str(b.payee)}, category = ${str(b.category)},
        amount = ${num(b.amount)}, currency = ${str(b.currency) ?? "INR"}, frequency = ${str(b.frequency) ?? "monthly"},
        next_due = ${str(b.nextDue)}, notes = ${str(b.notes)}, active = ${b.active === false ? false : true}
      where id = ${b.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from recurring_expenses where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
