import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { runBillImport } from "@/lib/gmail-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const accounts = await sql`select * from gmail_accounts where status = 'connected'`;
    if (accounts.length === 0) {
      return NextResponse.json({ error: "No Gmail account connected." }, { status: 400 });
    }
    const { imported, scanned, rateLimited } = await runBillImport(accounts);
    return NextResponse.json({ imported, scanned, rateLimited });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed." }, { status: 500 });
  }
}
