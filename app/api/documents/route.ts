import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function GET() {
  try {
    // Exclude the base64 blob to keep the list light.
    const rows = await sql`select id, name, category, filename, mime, notes, created_at from documents order by created_at desc`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.data) return NextResponse.json({ error: "Missing file." }, { status: 400 });
    // b.data is a data URL (data:<mime>;base64,<...>)
    const m = String(b.data).match(/^data:([^;]+);base64,([\s\S]*)$/);
    const mime = m ? m[1] : str(b.mime) || "application/octet-stream";
    const data = m ? m[2] : String(b.data);
    const [d] = await sql`
      insert into documents (name, category, filename, mime, data, notes)
      values (${str(b.name)}, ${str(b.category)}, ${str(b.filename)}, ${mime}, ${data}, ${str(b.notes)})
      returning id, name, category, filename, mime, notes, created_at
    `;
    return NextResponse.json(d);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from documents where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
