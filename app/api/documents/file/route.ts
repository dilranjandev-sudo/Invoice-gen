import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/documents/file?id=<docId> — streams the stored file.
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const [f] = await sql`select filename, mime, data from documents where id = ${id} limit 1`;
    if (!f || !f.data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const buf = Buffer.from(String(f.data), "base64");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": (f.mime as string) || "application/octet-stream",
        "Content-Disposition": `inline; filename="${((f.filename as string) || "document").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
