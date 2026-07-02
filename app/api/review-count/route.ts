import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Tiny, single-query endpoint for the sidebar badge — avoids hitting the heavy
// /api/stats (10 queries) just to show a count on every page.
export async function GET() {
  try {
    const [r] = await sql`
      select count(*) filter (where status in ('matched','unmatched'))::int as n from payments
    `;
    return NextResponse.json({ count: r?.n ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
