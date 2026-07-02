import "server-only";
import Groq from "groq-sdk";

export interface StatementLine {
  date: string | null;        // yyyy-mm-dd
  description: string | null;
  amount: number | null;      // positive number
  direction: "debit" | "credit";
  ref: string | null;         // UTR / cheque / reference if present
}

/**
 * Parse raw bank-statement text (from a CSV or a PDF's extracted text) into
 * structured lines using the LLM — robust to any bank's format.
 */
export async function parseStatementText(text: string): Promise<StatementLine[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set for statement parsing.");
  const groq = new Groq({ apiKey });

  const clipped = text.slice(0, 16000);
  const system = `You extract transactions from a bank statement.
Return ONLY a JSON object: {"lines":[{"date":"yyyy-mm-dd","description":string,"amount":number,"direction":"debit"|"credit","ref":string|null}]}.
- "debit" = money OUT of the account, "credit" = money IN.
- amount is always a positive number.
- ref = UTR / cheque no / transaction reference if present, else null.
- Skip header/summary/opening-closing-balance rows. Only real transactions.
- If a value is missing use null. Do not invent transactions.`;

  for (const model of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
    try {
      const c = await groq.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: clipped },
        ],
      });
      const raw = c.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      const lines: StatementLine[] = Array.isArray(parsed?.lines) ? parsed.lines : [];
      return lines
        .map((l) => ({
          date: l.date ? String(l.date).slice(0, 10) : null,
          description: l.description ? String(l.description).slice(0, 200) : null,
          amount: l.amount != null && Number.isFinite(Number(l.amount)) ? Math.abs(Number(l.amount)) : null,
          direction: (l.direction === "credit" ? "credit" : "debit") as "debit" | "credit",
          ref: l.ref ? String(l.ref).slice(0, 60) : null,
        }))
        .filter((l) => l.amount != null);
    } catch (e) {
      if (model === "llama-3.1-8b-instant" || !/429|rate.?limit|quota/i.test(String(e))) throw e;
    }
  }
  return [];
}
