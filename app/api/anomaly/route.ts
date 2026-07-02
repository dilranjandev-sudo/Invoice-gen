import { NextResponse } from "next/server";
import { billAnomaliesBatch } from "@/lib/anomaly";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { invoiceIds } = await req.json();
    if (!Array.isArray(invoiceIds)) return NextResponse.json({ error: "invoiceIds must be an array." }, { status: 400 });
    const flags = await billAnomaliesBatch(invoiceIds.filter(Boolean));
    return NextResponse.json({ flags });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
