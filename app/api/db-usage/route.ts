import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Supabase free tier = 500 MB. Override with DB_LIMIT_MB if you upgrade.
const LIMIT_MB = Number(process.env.DB_LIMIT_MB) || 500;

export async function GET() {
  try {
    const [size] = await sql`select pg_database_size(current_database()) as bytes`;
    const bytes = Number(size.bytes);
    const usedMb = bytes / (1024 * 1024);
    const remainingMb = Math.max(LIMIT_MB - usedMb, 0);
    const percent = Math.min((usedMb / LIMIT_MB) * 100, 100);

    const tables = await sql`
      select c.relname as name, pg_total_relation_size(c.oid) as bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc
      limit 6
    `;

    return NextResponse.json({
      usedMb,
      limitMb: LIMIT_MB,
      remainingMb,
      percent,
      tables: tables.map((t) => ({ name: t.name, mb: Number(t.bytes) / (1024 * 1024) })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read storage." },
      { status: 500 }
    );
  }
}
