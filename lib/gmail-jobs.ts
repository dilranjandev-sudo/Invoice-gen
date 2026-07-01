import "server-only";
import { oauthClient, google } from "@/lib/google";
import { sql } from "@/lib/db";
import { extractInvoice, extractPaymentFromText } from "@/lib/extract";
import { getRules, evaluateBill, logRejected } from "@/lib/rules";

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

/* ---- How far back to fetch (configurable in Settings) ---------------------- */

async function getFetchDays() {
  try {
    const rows = await sql`select key, value from app_settings where key in ('payment_days','bill_days','payment_from')`;
    const m: Record<string, string> = {};
    for (const r of rows) m[r.key as string] = r.value as string;
    const clamp = (v: number, def: number) => (Number.isFinite(v) && v >= 1 ? Math.min(v, 365) : def);
    return {
      paymentDays: clamp(Number(m.payment_days), 1),
      billDays: clamp(Number(m.bill_days), 60),
      // Only look at payment emails from this sender (bank). Default: Axis Bank.
      paymentFrom: (m.payment_from ?? "axis.bank.in").trim(),
    };
  } catch {
    return { paymentDays: 1, billDays: 60, paymentFrom: "axis.bank.in" };
  }
}

/* ---- Payments -------------------------------------------------------------- */

const PAYMENT_FILTER =
  '(debited OR credited OR "payment" OR paid OR UPI OR NEFT OR IMPS OR RTGS OR transaction OR transferred)';

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
  const { paymentDays, paymentFrom } = await getFetchDays();
  const fromClause = paymentFrom ? `from:(${paymentFrom}) ` : "";
  const query = `newer_than:${paymentDays}d ${fromClause}${PAYMENT_FILTER}`;

  outer: for (const acc of accounts) {
    if (!acc.refresh_token) continue;
    const client = oauthClient();
    client.setCredentials({ refresh_token: acc.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: client });

    let pageToken: string | undefined = undefined;
    let listed = 0;
    do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 25, pageToken });
    pageToken = list.data.nextPageToken ?? undefined;
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

      // Dedupe ONLY on a strong unique key (UTR/reference). Axis vendor-payment
      // alerts have no UTR, and the same vendor can legitimately be paid the same
      // amount 2-3x a day — those are separate emails (unique gmail_message_id),
      // so we keep them all rather than dropping repeats.
      if (p.utr) {
        const dup = await sql`select 1 from payments where utr = ${p.utr} limit 1`;
        if (dup.length) continue;
      } else if (p.reference) {
        const dup = await sql`select 1 from payments where reference = ${p.reference} and amount = ${p.amount} limit 1`;
        if (dup.length) continue;
      }

      await sql`
        insert into payments (
          gmail_account_id, gmail_message_id, payee, amount, currency, paid_on,
          reference, utr, mode, channel, account_detail, status, subject, snippet, body, raw
        ) values (
          ${acc.id}, ${m.id}, ${p.payee}, ${p.amount}, ${p.currency ?? "INR"}, ${p.date},
          ${p.reference}, ${p.utr}, ${p.mode}, ${p.channel}, ${p.accountDetail}, 'unmatched', ${subject}, ${snippet}, ${(body || snippet || "").slice(0, 8000)}, ${sql.json(JSON.parse(JSON.stringify(p)))}
        )
        on conflict (gmail_message_id) do nothing
      `;
      synced++;
    }
    listed += list.data.messages?.length ?? 0;
    } while (pageToken && !rateLimited && listed < 300);

    await sql`update gmail_accounts set last_sync_at = now() where id = ${acc.id}`;
  }

  return { synced, scanned, rateLimited };
}

/* ---- Bills ----------------------------------------------------------------- */

const BILL_FILTER = 'has:attachment filename:pdf (invoice OR "tax invoice" OR bill OR gst)';
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
  const rules = await getRules();
  const { billDays } = await getFetchDays();
  const query = `newer_than:${billDays}d ${BILL_FILTER}`;

  outer: for (const acc of accounts) {
    if (!acc.refresh_token) continue;
    const client = oauthClient();
    client.setCredentials({ refresh_token: acc.refresh_token });
    const gmail = google.gmail({ version: "v1", auth: client });

    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: 10 });

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

      const invNo = str(d.invoiceNumber);
      const vName = str(d.vendor);

      // Check duplicate, then run the rules engine.
      let duplicate = false;
      if (invNo && vName) {
        const dup = await sql`
          select 1 from invoices
          where lower(vendor_name) = lower(${vName}) and invoice_number = ${invNo}
          limit 1
        `;
        duplicate = dup.length > 0;
      }
      const verdict = evaluateBill(
        { vendor: vName, invoiceNumber: invNo, total: d.total, confidence: d.confidence, itemsCount: Array.isArray(d.items) ? d.items.length : 0 },
        { duplicate },
        rules
      );
      if (!verdict.accepted && verdict.rejectedBy) {
        await logRejected({
          source: "gmail",
          vendorName: vName,
          invoiceNumber: invNo,
          total: d.total ?? null,
          reasonKey: verdict.rejectedBy.key,
          reason: verdict.rejectedBy.reason,
        });
        continue; // rule blocked this — don't save junk/duplicates
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

      const [inv] = await sql`
        insert into invoices (
          vendor_id, vendor_name, vendor_gstin, buyer, buyer_gstin,
          invoice_number, invoice_date, due_date, place_of_supply, currency,
          subtotal, cgst, sgst, igst, gst, total, amount_paid, balance, status, category,
          items, bank_name, bank_account, bank_ifsc, raw, source, gmail_message_id, rule_notes
        ) values (
          ${vendorId}, ${vendorName}, ${str(d.vendorGstin)}, ${str(d.buyer)}, ${str(d.buyerGstin)},
          ${str(d.invoiceNumber)}, ${d.invoiceDate}, ${d.dueDate}, ${str(d.placeOfSupply)}, ${str(d.currency) ?? "INR"},
          ${d.subtotal}, ${d.cgst}, ${d.sgst}, ${d.igst}, ${d.gst}, ${d.total}, ${d.amountPaid}, ${d.balance}, ${str(d.status) ?? "unpaid"}, ${str(d.category)},
          ${d.items ? sql.json(JSON.parse(JSON.stringify(d.items))) : null}, ${str(d.bankName)}, ${str(d.bankAccount)}, ${str(d.bankIfsc)},
          ${sql.json(JSON.parse(JSON.stringify(d)))}, 'gmail', ${dedupeKey}, ${sql.json(JSON.parse(JSON.stringify(verdict.checks)))}
        )
        returning id
      `;
      // Keep the source PDF so the user can view it later.
      await sql`insert into bill_files (invoice_id, filename, mime, data) values (${inv.id}, ${pdf.filename}, 'application/pdf', ${base64})`;
      imported++;
      if (imported >= MAX_BILL_EXTRACT) break outer;
    }
  }

  return { imported, scanned, rateLimited };
}
