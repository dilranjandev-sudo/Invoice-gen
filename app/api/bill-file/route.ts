import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/bill-file?id=<invoiceId> — streams the stored source file (PDF/image).
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const [f] = await sql`
      select filename, mime, data from bill_files
      where invoice_id = ${id} order by created_at desc limit 1
    `;
    if (!f || !f.data) return NextResponse.json({ error: "No file for this bill." }, { status: 404 });

    const buf = Buffer.from(String(f.data), "base64");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": f.mime || "application/pdf",
        "Content-Disposition": `inline; filename="${(f.filename || "bill.pdf").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load file." }, { status: 500 });
  }
}
