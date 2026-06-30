import { NextResponse } from "next/server";
import { extractInvoice } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 413 });
    }

    const mimeType = file.type || "application/pdf";
    const ok =
      mimeType === "application/pdf" || mimeType.startsWith("image/");
    if (!ok) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF or image." },
        { status: 415 }
      );
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const data = await extractInvoice(base64, mimeType);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
