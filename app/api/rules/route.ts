import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rules = await sql`select key, name, description, enabled, threshold, action, sort from rules order by sort`;
    return NextResponse.json(rules);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load rules." }, { status: 500 });
  }
}

// Toggle enabled and/or update threshold for a rule.
export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.key) return NextResponse.json({ error: "Missing key." }, { status: 400 });
    const enabled = typeof b.enabled === "boolean" ? b.enabled : null;
    const threshold =
      b.threshold === undefined || b.threshold === "" || b.threshold === null ? null : Number(b.threshold);
    await sql`
      update rules set
        enabled = coalesce(${enabled}, enabled),
        threshold = coalesce(${threshold}, threshold),
        updated_at = now()
      where key = ${b.key}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}
