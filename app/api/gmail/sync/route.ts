import { NextResponse } from "next/server";
import { oauthClient, google } from "@/lib/google";
import { sql } from "@/lib/db";
import { extractPaymentFromText } from "@/lib/extract";
import { runMatching } from "@/lib/run-match";

export const runtime = "nodejs";
export const maxDuration = 60;

const QUERY =
  'newer_than:1d (debited OR credited OR "payment" OR paid OR UPI OR NEFT OR IMPS OR RTGS OR transaction OR transferred)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeBody(payload: any): string {
  if (!payload) return "";
  if (payload.parts?.length) {
    const plain = payload.parts.find((p: { mimeType?: string }) => p.mimeType === "text/plain");
    if (plain?.body?.data) return Buffer.from(plain.body.data, "base64url").toString("utf8");
    for (const part of payload.parts) {
      const t = decodeBody(part);
      if (t) return t;
    }
  }
  if (payload.body?.data) {
    const text = Buffer.from(payload.body.data, "base64url").toString("utf8");
    return payload.mimeType === "text/html"
      ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : text;
  }
  return "";
}

export async function POST() {
  try {
    const accounts = await sql`select * from gmail_accounts where status = 'connected'`;
    if (accounts.length === 0) {
      return NextResponse.json({ error: "No Gmail account connected." }, { status: 400 });
    }

    let synced = 0;
    let scanned = 0;

    let rateLimited = false;

    outer: for (const acc of accounts) {
      if (!acc.refresh_token) continue;
      const client = oauthClient();
      client.setCredentials({ refresh_token: acc.refresh_token });
      const gmail = google.gmail({ version: "v1", auth: client });

      const list = await gmail.users.messages.list({
        userId: "me",
        q: QUERY,
        maxResults: 6,
      });

      for (const m of list.data.messages ?? []) {
        if (!m.id) continue;
        // Skip anything we've already saved OR already looked at (incl. non-payments).
        const seen = await sql`
          select 1 from payments where gmail_message_id = ${m.id}
          union all select 1 from scanned_emails where gmail_message_id = ${m.id}
          limit 1
        `;
        if (seen.length) continue;
        scanned++;

        const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "full" });
        const headers = full.data.payload?.headers ?? [];
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
        const body = decodeBody(full.data.payload);
        const snippet = full.data.snippet ?? "";

        let p;
        try {
          p = await extractPaymentFromText(`${subject}\n${body || snippet}`);
        } catch (e) {
          // On rate-limit, stop now (don't burn more quota); retry on next sync.
          if (/429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(String(e))) {
            rateLimited = true;
            break outer;
          }
          continue;
        }

        // Remember we've processed this email so we never re-LLM it.
        await sql`insert into scanned_emails (gmail_message_id, gmail_account_id) values (${m.id}, ${acc.id}) on conflict (gmail_message_id) do nothing`;

        if (!p.isPayment || !p.amount) continue;

        await sql`
          insert into payments (
            gmail_account_id, gmail_message_id, payee, amount, currency, paid_on,
            reference, utr, mode, channel, account_detail, status, subject, snippet, raw
          ) values (
            ${acc.id}, ${m.id}, ${p.payee}, ${p.amount}, ${p.currency ?? "INR"}, ${p.date},
            ${p.reference}, ${p.utr}, ${p.mode}, ${p.channel}, ${p.accountDetail}, 'unmatched', ${subject}, ${snippet}, ${sql.json(JSON.parse(JSON.stringify(p)))}
          )
          on conflict (gmail_message_id) do nothing
        `;
        synced++;
      }

      await sql`update gmail_accounts set last_sync_at = now() where id = ${acc.id}`;
    }

    // Auto-match new payments to invoices (no manual step needed).
    const matched = await runMatching();

    return NextResponse.json({ synced, scanned, matched, rateLimited });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
