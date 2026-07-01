import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Recently blocked bills — what a rule rejected and why.
export async function GET() {
  try {
    const rows = await sql`
      select id, source, vendor_name, invoice_number, total, reason_key, reason, created_at
      from rejected_bills
      order by created_at desc
      limit 50
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load." }, { status: 500 });
  }
}

// Clear the blocked log.
export async function DELETE() {
  try {
    await sql`delete from rejected_bills`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
