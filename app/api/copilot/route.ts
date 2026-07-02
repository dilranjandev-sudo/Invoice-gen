import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const COMPANY = process.env.COMPANY_NAME || "Biqadx Private Limited";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") return NextResponse.json({ error: "Missing question." }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI is not configured (GROQ_API_KEY missing)." }, { status: 400 });

    // Gather a compact snapshot of the finances for the model to reason over.
    const [inv] = await sql`
      select count(*)::int as bills, coalesce(sum(total),0) as total_billed,
        coalesce(sum(total) filter (where status <> 'paid'),0) as outstanding,
        coalesce(sum(total) filter (where status = 'paid'),0) as paid,
        count(*) filter (where status <> 'paid')::int as unpaid_count
      from invoices`;
    const [pay] = await sql`
      select count(*)::int as payments, coalesce(sum(amount),0) as total_paid,
        count(*) filter (where status in ('matched','unmatched'))::int as to_review,
        coalesce(sum(amount) filter (where date_trunc('month', coalesce(paid_on, created_at::date)) = date_trunc('month', current_date)),0) as paid_this_month
      from payments`;
    const [ven] = await sql`select count(*)::int as n from vendors`;
    const unpaidBills = await sql`
      select vendor_name, invoice_number, total, due_date, status
      from invoices where status <> 'paid' order by due_date asc nulls last, created_at desc limit 40`;
    const topVendors = await sql`
      select v.name, coalesce(sum(i.total),0) as billed, count(i.id)::int as bills,
        coalesce(sum(i.total) filter (where i.status <> 'paid'),0) as outstanding
      from vendors v left join invoices i on i.vendor_id = v.id
      group by v.id having coalesce(sum(i.total),0) > 0 order by billed desc limit 15`;
    const recentPayments = await sql`select payee, amount, paid_on, status from payments order by created_at desc limit 20`;
    const recurringDue = await sql`
      select name, category, amount, next_due, frequency from recurring_expenses
      where active = true and next_due is not null order by next_due asc limit 20`;

    const data = {
      today: new Date().toISOString().slice(0, 10),
      currency: "INR",
      summary: { ...inv, ...pay, vendors: ven?.n },
      unpaidBills, topVendors, recentPayments, recurringDue,
    };

    const groq = new Groq({ apiKey });
    const system = `You are the finance assistant for ${COMPANY}, an accounts-payable app called PayRecord.
Answer the user's question using ONLY the JSON DATA provided. Do not invent numbers.
- All money is in Indian Rupees; format like ₹1,23,456. Dates are ISO (yyyy-mm-dd).
- Be concise and direct. Use short bullet points or a tiny table when listing.
- "outstanding"/"unpaid" = bills not yet paid. "to_review" = payments needing action.
- If the DATA doesn't contain the answer, say so briefly and suggest where to look in the app.
DATA:
${JSON.stringify(data)}`;

    let answer = "";
    for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
      try {
        const c = await groq.chat.completions.create({
          model,
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            { role: "system", content: system },
            { role: "user", content: question },
          ],
        });
        answer = c.choices[0]?.message?.content?.trim() || "";
        break;
      } catch (e) {
        if (model === "llama-3.1-8b-instant" || !/429|rate.?limit|quota/i.test(String(e))) throw e;
      }
    }

    return NextResponse.json({ answer: answer || "I couldn't generate an answer just now — please try again." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Copilot failed." }, { status: 500 });
  }
}
