import "server-only";
import { sql } from "@/lib/db";
import { billAnomalies } from "@/lib/anomaly";
import { paymentEmailHtml, sendGmailEmail } from "@/lib/email";

/**
 * Autopilot: auto-approve payments that are matched with high confidence AND
 * carry no high-severity anomaly on their bill. Marks the bill paid, the
 * payment approved, and (best-effort) emails the vendor a confirmation.
 * Off by default — enabled via the `autopilot_enabled` app setting.
 */
export async function runAutopilot(): Promise<{ approved: number; skipped: number; enabled: boolean }> {
  const [s] = await sql`select value from app_settings where key = 'autopilot_enabled'`;
  if (s?.value !== "true") return { approved: 0, skipped: 0, enabled: false };

  const [th] = await sql`select value from app_settings where key = 'autopilot_threshold'`;
  const threshold = Number(th?.value) || 95;

  const candidates = await sql`
    select id, matched_invoice_id, match_score, gmail_account_id
    from payments
    where status = 'matched' and matched_invoice_id is not null and match_score >= ${threshold}`;

  const [logo] = await sql`select 1 from app_settings where key = 'company_logo' and value is not null limit 1`;
  const logoUrl = logo && process.env.APP_URL ? `${process.env.APP_URL}/api/logo` : null;

  let approved = 0;
  let skipped = 0;

  for (const p of candidates) {
    const flags = await billAnomalies(p.matched_invoice_id as string);
    if (flags.some((f) => f.severity === "high")) {
      skipped++;
      continue; // leave anomalous ones for a human
    }

    await sql`update invoices set status = 'paid' where id = ${p.matched_invoice_id}`;
    await sql`update payments set status = 'approved' where id = ${p.id}`;
    approved++;

    // Best-effort vendor confirmation email.
    try {
      const [d] = await sql`
        select p.amount, p.currency, p.paid_on, p.mode, p.channel, p.reference, p.utr,
               i.invoice_number, v.name as vendor_name, v.email as vendor_email
        from payments p
        left join invoices i on i.id = p.matched_invoice_id
        left join vendors v on v.id = i.vendor_id
        where p.id = ${p.id}`;
      const acct = p.gmail_account_id
        ? (await sql`select email, refresh_token from gmail_accounts where id = ${p.gmail_account_id} and status = 'connected'`)[0]
        : (await sql`select email, refresh_token from gmail_accounts where status = 'connected' order by created_at limit 1`)[0];
      if (d?.vendor_email && acct?.refresh_token) {
        const html = paymentEmailHtml({
          vendorName: d.vendor_name || "Vendor",
          invoiceNumber: d.invoice_number,
          amount: Number(d.amount),
          currency: d.currency || "INR",
          paidOn: d.paid_on,
          mode: d.mode,
          channel: d.channel,
          reference: d.utr || d.reference,
          logoUrl,
        });
        const subject = d.invoice_number ? `Payment confirmation - Invoice ${d.invoice_number}` : "Payment confirmation";
        await sendGmailEmail(acct.refresh_token, acct.email, d.vendor_email, subject, html);
      }
    } catch {
      /* email is best-effort */
    }
  }

  return { approved, skipped, enabled: true };
}
