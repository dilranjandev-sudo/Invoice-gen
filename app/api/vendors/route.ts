import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from vendors where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`
      update vendors set
        name = ${s(b.name) ?? ""}, gstin = ${s(b.gstin)}, email = ${s(b.email)},
        phone = ${s(b.phone)}, address = ${s(b.address)}, tds_section = ${s(b.tds_section)}
      where id = ${b.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rows = await sql`
      select
        v.id, v.name, v.gstin, v.email, v.phone, v.address, v.tds_section, v.created_at,
        count(i.id)::int as invoice_count,
        coalesce(sum(i.total), 0) as total_billed
      from vendors v
      left join invoices i on i.vendor_id = v.id
      group by v.id
      order by v.created_at desc
    `;
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load vendors.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
