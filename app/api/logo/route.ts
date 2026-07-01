import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/logo — serves the company logo saved in Settings (used in vendor emails).
export async function GET() {
  try {
    const [row] = await sql`select value from app_settings where key = 'company_logo' limit 1`;
    const dataUrl = row?.value as string | undefined;
    if (!dataUrl || !dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "No logo set." }, { status: 404 });
    }
    const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (!m) return NextResponse.json({ error: "Bad logo." }, { status: 404 });
    const mime = m[1];
    const buf = Buffer.from(m[2], "base64");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
