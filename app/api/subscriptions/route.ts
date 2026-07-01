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

export async function GET() {
  try {
    const rows = await sql`select * from subscriptions order by renewal_date asc nulls last, created_at desc`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const [s] = await sql`
      insert into subscriptions (name, provider, purchased_from, category, purchase_date, renewal_date, price, currency, cycle, notes, status)
      values (${str(b.name)}, ${str(b.provider)}, ${str(b.purchasedFrom)}, ${str(b.category)}, ${str(b.purchaseDate)}, ${str(b.renewalDate)}, ${num(b.price)}, ${str(b.currency) ?? "INR"}, ${str(b.cycle)}, ${str(b.notes)}, ${str(b.status) ?? "active"})
      returning *
    `;
    return NextResponse.json(s);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`
      update subscriptions set
        name = ${str(b.name)}, provider = ${str(b.provider)}, purchased_from = ${str(b.purchasedFrom)},
        category = ${str(b.category)}, purchase_date = ${str(b.purchaseDate)}, renewal_date = ${str(b.renewalDate)},
        price = ${num(b.price)}, currency = ${str(b.currency) ?? "INR"}, cycle = ${str(b.cycle)},
        notes = ${str(b.notes)}, status = ${str(b.status) ?? "active"}
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
    await sql`delete from subscriptions where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
