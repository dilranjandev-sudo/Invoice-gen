import "server-only";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
// @ts-expect-error - pdf-parse lib path has no type declarations
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { ExtractedInvoice } from "@/lib/invoice-types";
import { validateGstin } from "@/lib/gst";

const GSTIN_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/g;

/** Find the vendor's GSTIN in raw invoice text (checksum-validated). */
function findGstin(text: string): string | null {
  // Prefer one right after a GST/GSTIN/GST No label (usually the seller's).
  const labeled = text.match(/GST(?:IN)?\s*(?:No\.?|number)?\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])/i);
  if (labeled && validateGstin(labeled[1])) return labeled[1].toUpperCase();
  const all = (text.match(GSTIN_PATTERN) || []).map((g) => g.toUpperCase()).filter(validateGstin);
  return all[0] ?? null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Find an invoice number in raw text when the LLM missed it. */
function findInvoiceNo(text: string): string | null {
  const m = text.match(/(?:invoice|bill|inv|tax invoice)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9/\-]{2,})/i);
  return m ? m[1].trim() : null;
}

/**
 * Deterministic clean-up pass — backfills GSTIN & invoice number from text and
 * reconciles amounts (subtotal + tax = total). Then computes an honest
 * confidence from how complete & consistent the result is.
 */
function reconcile(d: ExtractedInvoice, text: string): ExtractedInvoice {
  // GSTIN
  if (!d.vendorGstin || !validateGstin(d.vendorGstin)) {
    const g = findGstin(text);
    if (g) d.vendorGstin = g;
  }
  // Invoice number
  if (!d.invoiceNumber && text) {
    const n = findInvoiceNo(text);
    if (n) d.invoiceNumber = n;
  }

  // Amounts: subtotal + gst = total
  let subtotal = toNum(d.subtotal);
  let gst = toNum(d.gst);
  let total = toNum(d.total);
  const cgst = toNum(d.cgst), sgst = toNum(d.sgst), igst = toNum(d.igst);

  const comp = (cgst || 0) + (sgst || 0) + (igst || 0);
  if (gst == null && comp > 0) gst = comp;

  // GST can never exceed the taxable base (max rate 28%). If it does, the model
  // swapped subtotal & gst — swap them back.
  if (subtotal != null && gst != null && gst > subtotal && gst > 0) {
    [subtotal, gst] = [gst, subtotal];
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (total != null && subtotal != null) {
    // If the parts don't add up, trust total & subtotal and fix gst.
    if (gst == null || Math.abs(subtotal + gst - total) > 1) {
      if (total >= subtotal) gst = r2(total - subtotal);
    }
  } else if (total == null && subtotal != null && gst != null) {
    total = r2(subtotal + gst);
  } else if (subtotal == null && total != null && gst != null && total >= gst) {
    subtotal = r2(total - gst);
  }
  // If GST still isn't split out but a single standard rate is visible in the
  // text, derive taxable & GST from the gross total (total = taxable × (1+rate)).
  if (text && total != null && total > 0 && (gst == null || gst === 0)) {
    const rates = [...new Set([...text.matchAll(/(\d{1,2})\s*%/g)].map((m) => parseInt(m[1], 10)).filter((r) => [5, 12, 18, 28].includes(r)))];
    if (rates.length === 1) {
      const sub = r2(total / (1 + rates[0] / 100));
      subtotal = sub;
      gst = r2(total - sub);
    }
  }

  d.subtotal = subtotal;
  d.gst = gst;
  d.total = total;

  // Honest confidence from completeness + amount consistency.
  const weights: [boolean, number][] = [
    [!!d.vendor, 25],
    [!!d.invoiceNumber, 20],
    [total != null && total > 0, 25],
    [!!d.invoiceDate, 15],
    [!!(d.vendorGstin && validateGstin(d.vendorGstin)), 15],
  ];
  let conf = weights.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  // Small penalty if amounts still don't reconcile.
  if (subtotal != null && gst != null && total != null && Math.abs(subtotal + gst - total) > 1) conf -= 10;
  d.confidence = Math.max(0, Math.min(100, conf));
  return d;
}

const PROMPT = `You are an invoice/bill data extractor for an accounts-payable system.
Extract EVERY important field below and return ONLY a valid JSON object — no markdown, no commentary.

Rules:
- Normalize all dates to "YYYY-MM-DD".
- Amounts must be plain numbers (no currency symbols, no thousands separators). e.g. 1770 not "₹ 1,770.00".
- "vendor" is the SELLER / supplier (the company that issued the invoice). Capture its address, phone, email and GSTIN. Do NOT swap it with the buyer.
- "buyer" is the BILL-TO party.
- "invoiceNumber": look hard for it — labelled Invoice No / Bill No / Invoice # / Ref No, usually near the top or beside the date. Extract it exactly (keep letters, slashes, dashes). Only use null if it is truly absent.
- Read amounts carefully from the totals section; never guess or round.
- "subtotal" = total taxable amount before tax. "cgst"/"sgst"/"igst" = the respective tax amounts (null if that tax is not on the invoice). "gst" = total of all taxes.
- "total" = grand total. "amountPaid" = amount received (0 if not shown). "balance" = balance due.
- "status": "paid" if balance is 0 and total > 0, "partial" if 0 < amountPaid < total, otherwise "unpaid".
- "confidence": an integer 0-100 = your overall confidence that the extracted values are correct (be honest; lower it if the document is unclear or fields are missing).
- "category": classify what this bill is for. Pick the single best fit from EXACTLY this list: "Rent", "Utilities", "Software", "Marketing", "Travel", "Office Supplies", "Professional Fees", "Inventory", "Logistics", "Telecom", "Other". Use "Other" only if none fit.
- Capture bank details if present. If a field is not present, use null. "items" should be an array (empty if none).

JSON shape:
{
  "vendor": string|null, "vendorGstin": string|null, "vendorAddress": string|null, "vendorPhone": string|null, "vendorEmail": string|null,
  "buyer": string|null, "buyerGstin": string|null,
  "invoiceNumber": string|null, "invoiceDate": string|null, "dueDate": string|null, "placeOfSupply": string|null, "currency": string|null,
  "subtotal": number|null, "cgst": number|null, "sgst": number|null, "igst": number|null, "gst": number|null,
  "total": number|null, "amountPaid": number|null, "balance": number|null,
  "status": "paid"|"partial"|"unpaid"|null,
  "confidence": number,
  "category": "Rent"|"Utilities"|"Software"|"Marketing"|"Travel"|"Office Supplies"|"Professional Fees"|"Inventory"|"Logistics"|"Telecom"|"Other",
  "items": [{ "name": string|null, "hsn": string|null, "qty": number|null, "unitPrice": number|null, "gst": number|null, "amount": number|null }],
  "bankName": string|null, "bankAccount": string|null, "bankIfsc": string|null
}`;

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  }
}

/* ---- Payment extraction (from Gmail email text) ---------------------------- */

export interface ExtractedPayment {
  isPayment: boolean;
  payee: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  reference: string | null;
  utr: string | null;
  mode: string | null;
  channel: string | null;
  accountDetail: string | null;
  direction: "debit" | "credit" | null;
}

const PAYMENT_PROMPT = `You read a bank/UPI/payment-gateway confirmation email and extract the transaction.
Return ONLY valid JSON. If the email is NOT a payment/transaction confirmation, set "isPayment": false and other fields null.

Rules:
- Dates as "YYYY-MM-DD". Amounts as plain numbers (no symbols/commas).
- "payee" = the merchant/person the money went to (for a debit) or the sender (for a credit). Null if unknown.
- "mode": one of UPI, NEFT, IMPS, RTGS, Card, Bank Transfer, etc.
- "channel": the bank or app, e.g. "Axis Bank", "HDFC Bank", "Google Pay", "PhonePe".
- "accountDetail": masked account/UPI id if shown, e.g. "•••• 2773".
- "direction": "debit" if money left the account, "credit" if received.

JSON shape:
{ "isPayment": boolean, "payee": string|null, "amount": number|null, "currency": string|null, "date": string|null, "reference": string|null, "utr": string|null, "mode": string|null, "channel": string|null, "accountDetail": string|null, "direction": "debit"|"credit"|null }`;

/**
 * Axis Bank vendor-payment alerts have a fixed wording, so parse them
 * deterministically (100% accurate + free) instead of relying on the LLM,
 * which mis-reads amounts and grabs footer codes as UTRs.
 * e.g. "Vendor payment to DILRANJAN KUMAR of INR 30000.00 raised by ARUN
 *       ARUN KUMAR has been successfully processed."
 */
function parseAxisVendorPayment(text: string): ExtractedPayment | null {
  const t = text.replace(/\s+/g, " ");
  const m = t.match(/payment to (.+?) of INR\s*([\d,]+(?:\.\d+)?)/i);
  if (!m) return null;
  const payee = m[1].replace(/\braised by\b.*$/i, "").trim();
  const amount = Number(m[2].replace(/,/g, ""));
  if (!payee || !Number.isFinite(amount) || amount <= 0) return null;
  const dm = t.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
  const date = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null;
  // Try to pick up a real UTR/RRN if present (12+ digits), never the footer code.
  const utrMatch = t.match(/\b(?:UTR|RRN|Ref(?:erence)? No\.?)[:\s]*([A-Z0-9]{10,})\b/i);
  return {
    isPayment: true,
    payee,
    amount,
    currency: "INR",
    date,
    reference: null,
    utr: utrMatch ? utrMatch[1] : null,
    mode: "Vendor Payment",
    channel: "Axis Bank",
    accountDetail: null,
    direction: "debit",
  };
}

export async function extractPaymentFromText(text: string): Promise<ExtractedPayment> {
  // Fast, exact path for Axis Bank's fixed-format alerts.
  const axis = parseAxisVendorPayment(text);
  if (axis) return axis;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set for payment extraction.");
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You return only valid JSON." },
      { role: "user", content: `${PAYMENT_PROMPT}\n\nEMAIL:\n"""\n${text.slice(0, 6000)}\n"""` },
    ],
  });
  return parseJson<ExtractedPayment>(completion.choices[0]?.message?.content ?? "");
}

/* ---- Groq (free) ----------------------------------------------------------- */

async function extractWithGroq(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedInvoice> {
  const groq = new Groq({ apiKey });

  if (mimeType === "application/pdf") {
    // Pull text locally (free), then have Groq structure it.
    const buffer = Buffer.from(base64, "base64");
    const { text } = await pdfParse(buffer);
    if (!text || text.trim().length < 20) {
      throw new Error(
        "This looks like a scanned PDF with no embedded text. Upload an image (PNG/JPG) of the bill instead."
      );
    }
    const messages = [
      { role: "system" as const, content: "You return only valid JSON. Read carefully and never invent values." },
      { role: "user" as const, content: `${PROMPT}\n\nINVOICE TEXT:\n"""\n${text}\n"""` },
    ];
    // Prefer the far more accurate 70B model; fall back to 8B if it's rate-limited.
    for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages,
        });
        return reconcile(parseJson<ExtractedInvoice>(completion.choices[0]?.message?.content ?? ""), text);
      } catch (e) {
        if (model === "llama-3.1-8b-instant" || !/429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(String(e))) throw e;
        // else: 70B is rate-limited → retry loop falls through to 8B
      }
    }
    throw new Error("AI extraction unavailable.");
  }

  // Image → Groq vision model
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  });
  return reconcile(parseJson<ExtractedInvoice>(completion.choices[0]?.message?.content ?? ""), "");
}

/* ---- Gemini (free, if available) ------------------------------------------- */

async function extractWithGemini(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedInvoice> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: [
      { role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPT }] },
    ],
    config: { responseMimeType: "application/json", temperature: 0 },
  });
  if (!response.text) throw new Error("Empty response from Gemini.");
  return reconcile(parseJson<ExtractedInvoice>(response.text), "");
}

/* ---- Entry point ----------------------------------------------------------- */

export async function extractInvoice(
  base64: string,
  mimeType: string
): Promise<ExtractedInvoice> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const hasGemini = !!geminiKey && geminiKey !== "your_gemini_api_key_here";

  try {
    if (groqKey) return await extractWithGroq(base64, mimeType, groqKey);
    if (hasGemini) return await extractWithGemini(base64, mimeType, geminiKey!);
    throw new Error(
      "No AI key configured. Add GROQ_API_KEY (free at https://console.groq.com/keys) or GEMINI_API_KEY to .env.local."
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("429") || /quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(raw)) {
      throw new Error("AI quota/rate limit hit for this key. Try again shortly or use a key with quota.");
    }
    if (/401|403|api key|invalid|PERMISSION/i.test(raw)) {
      throw new Error("The AI API key is invalid or not enabled.");
    }
    throw new Error(raw.slice(0, 220));
  }
}
