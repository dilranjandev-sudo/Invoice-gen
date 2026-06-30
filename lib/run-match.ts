import "server-only";
import { sql } from "@/lib/db";
import { bestMatch, type MatchInvoice, type MatchPayment } from "@/lib/match";

/** Link every still-unmatched payment to its best invoice. Returns # newly matched. */
export async function runMatching(): Promise<number> {
  const payments = (await sql`
    select id, payee, amount, paid_on, matched_invoice_id from payments
  `) as unknown as (MatchPayment & { matched_invoice_id: string | null })[];
  const invoices = (await sql`
    select id, vendor_name, total, invoice_date, due_date from invoices
  `) as unknown as MatchInvoice[];

  let matched = 0;
  for (const p of payments) {
    if (p.matched_invoice_id) continue;
    const best = bestMatch(p, invoices);
    if (best) {
      await sql`
        update payments
        set matched_invoice_id = ${best.invoice.id}, match_score = ${best.score}, status = 'matched'
        where id = ${p.id}
      `;
      matched++;
    }
  }
  return matched;
}
