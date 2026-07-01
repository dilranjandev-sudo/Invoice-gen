import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/vendors/ledger?id=<vendorId> — full statement for one vendor.
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing vendor id." }, { status: 400 });

    const [vendor] = await sql`select id, name, gstin, email, phone, address from vendors where id = ${id}`;
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

    const bills = await sql`
      select id, invoice_number, invoice_date, total, amount_paid, status, category
      from invoices
      where vendor_id = ${id}
      order by invoice_date desc nulls last, created_at desc
    `;

    const payments = await sql`
      select p.id, p.payee, p.amount, p.paid_on, p.mode, p.channel, p.reference, p.utr,
             i.invoice_number as invoice_number
      from payments p
      join invoices i on i.id = p.matched_invoice_id
      where i.vendor_id = ${id}
      order by p.paid_on desc nulls last, p.created_at desc
    `;

    const [totals] = await sql`
      select
        coalesce(sum(total), 0) as billed,
        coalesce(sum(case when status = 'paid' then total
                          when status = 'partial' then coalesce(amount_paid, 0)
                          else 0 end), 0) as paid,
        count(*)::int as bill_count
      from invoices where vendor_id = ${id}
    `;
    const pending = Number(totals.billed) - Number(totals.paid);

    return NextResponse.json({
      vendor,
      bills,
      payments,
      totals: { billed: Number(totals.billed), paid: Number(totals.paid), pending, billCount: totals.bill_count },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load ledger." }, { status: 500 });
  }
}
