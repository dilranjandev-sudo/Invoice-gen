import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from payments where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const amt = b.amount === "" || b.amount == null ? null : Number(b.amount);
    await sql`
      update payments set
        payee = ${b.payee ? String(b.payee).trim() : null},
        amount = ${amt},
        status = ${b.status || "unmatched"}
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
        p.*,
        a.email as source_email,
        i.invoice_number as matched_invoice_no,
        i.total as matched_invoice_total
      from payments p
      left join gmail_accounts a on a.id = p.gmail_account_id
      left join invoices i on i.id = p.matched_invoice_id
      order by coalesce(p.paid_on, p.created_at::date) desc, p.created_at desc
      limit 200
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load payments." },
      { status: 500 }
    );
  }
}
