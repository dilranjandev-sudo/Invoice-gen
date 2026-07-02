import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { runRecurringReminders } from "@/lib/reminders";

export const runtime = "nodejs";

// Manual trigger — send the recurring-due digest now (ignores the once-a-day
// guard so you can test it).
export async function POST() {
  try {
    await sql`delete from app_settings where key = 'recurring_reminder_last'`;
    const res = await runRecurringReminders();
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
