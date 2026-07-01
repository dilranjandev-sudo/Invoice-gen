import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Exclude the logo blob (served via /api/logo) to keep this response small.
    const rows = await sql`select key, value from app_settings where key <> 'company_logo'`;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key as string] = r.value as string;
    map.has_logo = "unknown"; // LogoSetting checks /api/logo directly
    return NextResponse.json(map);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: "Missing key." }, { status: 400 });
    await sql`
      insert into app_settings (key, value) values (${key}, ${String(value)})
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
