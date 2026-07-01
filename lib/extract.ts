import "server-only";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
// @ts-expect-error - pdf-parse lib path has no type declarations
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { ExtractedInvoice } from "@/lib/invoice-types";

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
        return parseJson(completion.choices[0]?.message?.content ?? "");
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
  return parseJson(completion.choices[0]?.message?.content ?? "");
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
  return parseJson(response.text);
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
