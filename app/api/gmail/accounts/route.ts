import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await sql`
      select
        a.id, a.email, a.status, a.last_sync_at, a.created_at,
        count(p.id)::int as payment_count
      from gmail_accounts a
      left join payments p on p.gmail_account_id = a.id
      group by a.id
      order by a.created_at desc
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load accounts." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from gmail_accounts where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect." },
      { status: 500 }
    );
  }
}
