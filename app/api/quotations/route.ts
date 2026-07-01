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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function totals(items: any[]) {
  let subtotal = 0;
  let gst = 0;
  for (const it of items || []) {
    const amt = Number(it.amount) || 0;
    subtotal += amt;
    gst += amt * ((Number(it.gst) || 0) / 100);
  }
  return { subtotal: Math.round(subtotal * 100) / 100, gst: Math.round(gst * 100) / 100, total: Math.round((subtotal + gst) * 100) / 100 };
}

export async function GET() {
  try {
    const rows = await sql`select * from quotations order by created_at desc limit 200`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const items = Array.isArray(b.items) ? b.items.filter((i: { name?: string; amount?: unknown }) => i && (i.name || i.amount)) : [];
    const t = totals(items);

    const year = (str(b.quoteDate)?.slice(0, 4)) || String(new Date().getFullYear());
    const [c] = await sql`select count(*)::int as n from quotations where quote_number like ${"QUO-" + year + "-%"}`;
    const quoteNumber = `QUO-${year}-${String((c.n || 0) + 1).padStart(3, "0")}`;

    const [q] = await sql`
      insert into quotations (
        quote_number, customer_name, customer_email, customer_gstin, customer_address,
        quote_date, valid_until, currency, items, subtotal, gst, total, notes, status
      ) values (
        ${quoteNumber}, ${str(b.customerName)}, ${str(b.customerEmail)}, ${str(b.customerGstin)}, ${str(b.customerAddress)},
        ${str(b.quoteDate)}, ${str(b.validUntil)}, ${str(b.currency) ?? "INR"},
        ${sql.json(JSON.parse(JSON.stringify(items)))}, ${t.subtotal}, ${t.gst}, ${t.total}, ${str(b.notes)}, 'draft'
      ) returning *
    `;
    return NextResponse.json(q);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const items = Array.isArray(b.items) ? b.items.filter((i: { name?: string; amount?: unknown }) => i && (i.name || i.amount)) : [];
    const t = totals(items);
    await sql`
      update quotations set
        customer_name = ${str(b.customerName)}, customer_email = ${str(b.customerEmail)},
        customer_gstin = ${str(b.customerGstin)}, customer_address = ${str(b.customerAddress)},
        quote_date = ${str(b.quoteDate)}, valid_until = ${str(b.validUntil)}, currency = ${str(b.currency) ?? "INR"},
        items = ${sql.json(JSON.parse(JSON.stringify(items)))}, subtotal = ${t.subtotal}, gst = ${t.gst}, total = ${t.total},
        notes = ${str(b.notes)}
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
    await sql`delete from quotations where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
