import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Public keep-warm endpoint — pings the DB so a cron can keep the app/pool warm.
export async function GET() {
  try {
    await sql`select 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
