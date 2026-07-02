import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendGmailEmail } from "@/lib/email";
import { poEmailHtml } from "@/lib/po-email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const [po] = await sql`select * from purchase_orders where id = ${id}`;
    if (!po) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
    if (!po.vendor_email) return NextResponse.json({ error: "This PO has no vendor email." }, { status: 400 });

    const [acct] = await sql`select email, refresh_token from gmail_accounts where status = 'connected' order by created_at limit 1`;
    if (!acct?.refresh_token) return NextResponse.json({ error: "Connect a Gmail account first." }, { status: 400 });

    const [logo] = await sql`select 1 from app_settings where key = 'company_logo' and value is not null limit 1`;
    const logoUrl = logo && process.env.APP_URL ? `${process.env.APP_URL}/api/logo` : null;

    const html = poEmailHtml({
      poNumber: po.po_number as string,
      vendorName: (po.vendor_name as string) || "Vendor",
      orderDate: po.order_date as string | null,
      expectedDate: po.expected_date as string | null,
      currency: (po.currency as string) || "INR",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (po.items as any[]) || [],
      subtotal: po.subtotal != null ? Number(po.subtotal) : null,
      gst: po.gst != null ? Number(po.gst) : null,
      total: po.total != null ? Number(po.total) : null,
      notes: po.notes as string | null,
      logoUrl,
    });
    const subject = `Purchase Order ${po.po_number} from ${process.env.COMPANY_NAME || "Biqadx Private Limited"}`;
    await sendGmailEmail(acct.refresh_token as string, acct.email as string, po.vendor_email as string, subject, html);

    await sql`update purchase_orders set status = 'sent' where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed." }, { status: 500 });
  }
}
