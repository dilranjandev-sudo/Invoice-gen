import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Input GST / ITC summary — all computed from your own bills. No external service.
export async function GET() {
  try {
    const [totals] = await sql`
      select
        count(*)::int as bills,
        coalesce(sum(subtotal), 0) as taxable,
        coalesce(sum(cgst), 0) as cgst,
        coalesce(sum(sgst), 0) as sgst,
        coalesce(sum(igst), 0) as igst,
        coalesce(sum(gst), 0) as total_gst,
        coalesce(sum(total), 0) as total
      from invoices
    `;

    // Last 6 months of input GST
    const monthly = await sql`
      with months as (
        select generate_series(
          date_trunc('month', current_date) - interval '5 months',
          date_trunc('month', current_date),
          interval '1 month'
        ) as m
      )
      select to_char(months.m, 'Mon') as label, coalesce(sum(i.gst), 0) as gst
      from months
      left join invoices i on date_trunc('month', coalesce(i.invoice_date, i.created_at::date)) = months.m
      group by months.m order by months.m
    `;

    // GST paid per vendor
    const byVendor = await sql`
      select coalesce(nullif(vendor_name, ''), 'Unknown') as vendor,
             coalesce(sum(gst), 0) as gst,
             coalesce(sum(subtotal), 0) as taxable,
             count(*)::int as bills
      from invoices
      group by 1 order by sum(gst) desc nulls last limit 12
    `;

    // Effective GST-rate buckets
    const byRate = await sql`
      select
        case when subtotal is null or subtotal = 0 or gst is null then 'N/A'
             else (round(gst / subtotal * 100)::int)::text || '%' end as rate,
        coalesce(sum(gst), 0) as gst,
        coalesce(sum(subtotal), 0) as taxable,
        count(*)::int as bills
      from invoices
      group by 1 order by sum(gst) desc nulls last
    `;

    // GSTR-3B style monthly ITC breakup (last 12 months)
    const gstr3b = await sql`
      with months as (
        select generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month') as m
      )
      select to_char(months.m, 'Mon YYYY') as month,
             coalesce(sum(i.subtotal), 0) as taxable,
             coalesce(sum(i.cgst), 0) as cgst,
             coalesce(sum(i.sgst), 0) as sgst,
             coalesce(sum(i.igst), 0) as igst,
             coalesce(sum(i.gst), 0) as total_gst,
             count(i.id)::int as bills
      from months
      left join invoices i on date_trunc('month', coalesce(i.invoice_date, i.created_at::date)) = months.m
      group by months.m order by months.m desc
    `;

    // Intra vs inter state (CGST+SGST vs IGST)
    const intra = Number(totals.cgst) + Number(totals.sgst);
    const inter = Number(totals.igst);

    return NextResponse.json({ totals, monthly, byVendor, byRate, gstr3b, split: { intra, inter } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load GST." }, { status: 500 });
  }
}
