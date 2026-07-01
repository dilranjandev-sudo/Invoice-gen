import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email";
import { quotationEmailHtml } from "@/lib/quotation-email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const [q] = await sql`select * from quotations where id = ${id}`;
    if (!q) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
    if (!q.customer_email) return NextResponse.json({ error: "This quotation has no customer email." }, { status: 400 });

    const [acct] = await sql`select email, refresh_token from gmail_accounts where status = 'connected' order by created_at limit 1`;
    if (!acct?.refresh_token) return NextResponse.json({ error: "Connect a Gmail account first." }, { status: 400 });

    const [logo] = await sql`select 1 from app_settings where key = 'company_logo' and value is not null limit 1`;
    const logoUrl = logo && process.env.APP_URL ? `${process.env.APP_URL}/api/logo` : null;

    const html = quotationEmailHtml({
      quoteNumber: q.quote_number as string,
      customerName: (q.customer_name as string) || "Customer",
      quoteDate: q.quote_date as string | null,
      validUntil: q.valid_until as string | null,
      currency: (q.currency as string) || "INR",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (q.items as any[]) || [],
      subtotal: q.subtotal != null ? Number(q.subtotal) : null,
      gst: q.gst != null ? Number(q.gst) : null,
      total: q.total != null ? Number(q.total) : null,
      notes: q.notes as string | null,
      logoUrl,
    });
    const subject = `Quotation ${q.quote_number} from ${process.env.COMPANY_NAME || "Biqadx Private Limited"}`;
    await sendGmailEmail(acct.refresh_token as string, acct.email as string, q.customer_email as string, subject, html);

    await sql`update quotations set status = 'sent', sent_at = now() where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed." }, { status: 500 });
  }
}
