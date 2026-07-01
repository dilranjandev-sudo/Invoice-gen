import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { runPaymentSync, runBillImport } from "@/lib/gmail-jobs";
import { runMatching } from "@/lib/run-match";

export const runtime = "nodejs";
export const maxDuration = 60;

// One sync to rule them all: pulls payments AND bills from Gmail, then matches.
export async function POST() {
  try {
    const accounts = await sql`select * from gmail_accounts where status = 'connected'`;
    if (accounts.length === 0) {
      return NextResponse.json({ error: "No Gmail account connected." }, { status: 400 });
    }

    // Payments first (lighter, time-sensitive), then bills.
    const payments = await runPaymentSync(accounts);
    const bills = payments.rateLimited
      ? { imported: 0, scanned: 0, rateLimited: true }
      : await runBillImport(accounts);
    const matched = await runMatching();

    return NextResponse.json({
      accounts: accounts.length,
      payments,
      bills,
      matched,
      rateLimited: payments.rateLimited || bills.rateLimited,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
