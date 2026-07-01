import "server-only";
import { oauthClient, google } from "@/lib/google";
import { sql } from "@/lib/db";
import { extractInvoice, extractPaymentFromText } from "@/lib/extract";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Account = Record<string, any>;

function isRate(e: unknown) {
  return /429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(String(e));
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/* ---- Payments -------------------------------------------------------------- */

const PAYMENT_QUERY =
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

export async function runPaymentSync(accounts: Account[]) {
  let synced = 0;
  let scanned = 0;
  let rateLimited = false;

  outer: for (const acc of accounts) {
    if (!acc.refresh_token) continue;
    const client = oauthClient();
    client.setCredentials({ refresh_token: acc.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: client });

    const list = await gmail.users.messages.list({ userId: "me", q: PAYMENT_QUERY, maxResults: 6 });

    for (const m of list.data.messages ?? []) {
      if (!m.id) continue;
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
        if (isRate(e)) { rateLimited = true; break outer; }
        continue;
      }

      await sql`insert into scanned_emails (gmail_message_id, gmail_account_id) values (${m.id}, ${acc.id}) on conflict (gmail_message_id) do nothing`;
      if (!p.isPayment || !p.amount) continue;

      // Skip if this same payment already exists (different email, same txn).
      let dupRows;
      if (p.utr) {
        dupRows = await sql`select 1 from payments where utr = ${p.utr} limit 1`;
      } else if (p.reference) {
        dupRows = await sql`select 1 from payments where reference = ${p.reference} and amount = ${p.amount} limit 1`;
      } else {
        dupRows = await sql`select 1 from payments where payee = ${p.payee} and amount = ${p.amount} and paid_on = ${p.date} limit 1`;
      }
      if (dupRows.length) continue;

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

  return { synced, scanned, rateLimited };
}

/* ---- Bills ----------------------------------------------------------------- */

const BILL_QUERY = 'has:attachment filename:pdf newer_than:60d (invoice OR "tax invoice" OR bill OR gst)';
const MAX_BILL_EXTRACT = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pdfParts(payload: any, acc: { id: string; filename: string }[] = []) {
  if (!payload) return acc;
  const isPdf =
    payload.mimeType === "application/pdf" || (payload.filename && /\.pdf$/i.test(payload.filename));
  if (isPdf && payload.body?.attachmentId) {
    acc.push({ id: payload.body.attachmentId, filename: payload.filename || "bill.pdf" });
  }
  if (payload.parts) for (const part of payload.parts) pdfParts(part, acc);
  return acc;
}

export async function runBillImport(accounts: Account[]) {
  let imported = 0;
  let scanned = 0;
  let rateLimited = false;

  outer: for (const acc of accounts) {
    if (!acc.refresh_token) continue;
    const client = oauthClient();
    client.setCredentials({ refresh_token: acc.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: client });

    const list = await gmail.users.messages.list({ userId: "me", q: BILL_QUERY, maxResults: 10 });

    for (const msg of list.data.messages ?? []) {
      if (!msg.id) continue;
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const pdfs = pdfParts(full.data.payload);
      if (pdfs.length === 0) continue;

      const pdf = pdfs[0];
      const dedupeKey = `${msg.id}:${pdf.id.slice(0, 24)}`;
      const seen = await sql`select 1 from invoices where gmail_message_id = ${dedupeKey} limit 1`;
      if (seen.length) continue;
      scanned++;

      const att = await gmail.users.messages.attachments.get({ userId: "me", messageId: msg.id, id: pdf.id });
      const dataUrl = att.data.data;
      if (!dataUrl) continue;
      const base64 = Buffer.from(dataUrl, "base64url").toString("base64");

      let d;
      try {
        d = await extractInvoice(base64, "application/pdf");
      } catch (e) {
        if (isRate(e)) { rateLimited = true; break outer; }
        continue;
      }

      // Skip if we already have this exact bill (same vendor + invoice number).
      const invNo = str(d.invoiceNumber);
      const vName = str(d.vendor);
      if (invNo && vName) {
        const dup = await sql`
          select 1 from invoices
          where lower(vendor_name) = lower(${vName}) and invoice_number = ${invNo}
          limit 1
        `;
        if (dup.length) continue;
      }

      let vendorId: string | null = null;
      const vendorName = str(d.vendor);
      if (vendorName) {
        const [v] = await sql`
          insert into vendors (name, gstin, address, phone, email)
          values (${vendorName}, ${str(d.vendorGstin)}, ${str(d.vendorAddress)}, ${str(d.vendorPhone)}, ${str(d.vendorEmail)})
          on conflict (lower(name)) do update
            set gstin = coalesce(excluded.gstin, vendors.gstin), email = coalesce(excluded.email, vendors.email)
          returning id
        `;
        vendorId = v.id;
      }

      await sql`
        insert into invoices (
          vendor_id, vendor_name, vendor_gstin, buyer, buyer_gstin,
          invoice_number, invoice_date, due_date, place_of_supply, currency,
          subtotal, cgst, sgst, igst, gst, total, amount_paid, balance, status, category,
          items, bank_name, bank_account, bank_ifsc, raw, source, gmail_message_id
        ) values (
          ${vendorId}, ${vendorName}, ${str(d.vendorGstin)}, ${str(d.buyer)}, ${str(d.buyerGstin)},
          ${str(d.invoiceNumber)}, ${d.invoiceDate}, ${d.dueDate}, ${str(d.placeOfSupply)}, ${str(d.currency) ?? "INR"},
          ${d.subtotal}, ${d.cgst}, ${d.sgst}, ${d.igst}, ${d.gst}, ${d.total}, ${d.amountPaid}, ${d.balance}, ${str(d.status) ?? "unpaid"}, ${str(d.category)},
          ${d.items ? sql.json(JSON.parse(JSON.stringify(d.items))) : null}, ${str(d.bankName)}, ${str(d.bankAccount)}, ${str(d.bankIfsc)},
          ${sql.json(JSON.parse(JSON.stringify(d)))}, 'gmail', ${dedupeKey}
        )
      `;
      imported++;
      if (imported >= MAX_BILL_EXTRACT) break outer;
    }
  }

  return { imported, scanned, rateLimited };
}
