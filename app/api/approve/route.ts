import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { paymentEmailHtml, sendGmailEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { paymentId, action } = await req.json();
    if (!paymentId) return NextResponse.json({ error: "Missing paymentId." }, { status: 400 });

    const [p] = await sql`select id, matched_invoice_id, gmail_account_id from payments where id = ${paymentId}`;
    if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

    if (action === "reject") {
      await sql`update payments set matched_invoice_id = null, match_score = null, status = 'unmatched' where id = ${paymentId}`;
      return NextResponse.json({ ok: true, status: "unmatched" });
    }

    // approve → mark invoice paid + payment approved
    if (p.matched_invoice_id) {
      await sql`update invoices set status = 'paid' where id = ${p.matched_invoice_id}`;
    }
    await sql`update payments set status = 'approved' where id = ${paymentId}`;

    // Best-effort: email the vendor a payment confirmation
    let emailed = false;
    let emailError: string | null = null;
    try {
      const [d] = await sql`
        select p.amount, p.currency, p.paid_on, p.mode, p.channel, p.reference, p.utr,
               i.invoice_number, v.name as vendor_name, v.email as vendor_email
        from payments p
        left join invoices i on i.id = p.matched_invoice_id
        left join vendors v on v.id = i.vendor_id
        where p.id = ${paymentId}
      `;
      const acct = p.gmail_account_id
        ? (await sql`select email, refresh_token from gmail_accounts where id = ${p.gmail_account_id} and status = 'connected'`)[0]
        : (await sql`select email, refresh_token from gmail_accounts where status = 'connected' order by created_at limit 1`)[0];

      // Include the company logo in the email if one is set in Settings.
      const [logo] = await sql`select 1 from app_settings where key = 'company_logo' and value is not null limit 1`;
      const logoUrl = logo && process.env.APP_URL ? `${process.env.APP_URL}/api/logo` : null;

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
        const subject = d.invoice_number
          ? `Payment confirmation - Invoice ${d.invoice_number}`
          : "Payment confirmation";
        await sendGmailEmail(acct.refresh_token, acct.email, d.vendor_email, subject, html);
        emailed = true;
      } else if (!d?.vendor_email) {
        emailError = "no_vendor_email";
      } else {
        emailError = "no_connected_gmail";
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "send_failed";
    }

    return NextResponse.json({ ok: true, status: "approved", emailed, emailError });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed." },
      { status: 500 }
    );
  }
}
