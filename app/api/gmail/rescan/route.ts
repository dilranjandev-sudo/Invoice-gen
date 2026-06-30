import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Clear the "already scanned" memory so the next sync re-reads every email
 * from scratch. Use when a payment was deleted by mistake and you want it
 * pulled again. Payments that still exist are NOT duplicated — the sync
 * insert is `on conflict (gmail_message_id) do nothing`.
 */
export async function POST() {
  try {
    const cleared = await sql`delete from scanned_emails`;
    return NextResponse.json({ ok: true, cleared: cleared.count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Re-scan failed." },
      { status: 500 }
    );
  }
}
