import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Run sequentially on a single reused connection. Firing 10 queries in
    // parallel forces the Supabase pgbouncer pooler to open many connections at
    // once; opening a cold pooler connection is slow/flaky on the free tier and
    // one straggler stalls the whole request (Promise.all waits for all).
    // Sequential keeps us on one warm connection → consistent ~1.5s.
    const [inv] = await sql`
      select
        count(*)::int as n,
        coalesce(sum(total), 0) as total,
        coalesce(sum(total) filter (where status <> 'paid'), 0) as outstanding,
        coalesce(sum(total) filter (where status = 'paid'), 0) as paid_amount,
        count(*) filter (where status = 'paid')::int as paid,
        count(*) filter (where status = 'partial')::int as partial,
        count(*) filter (where status = 'unpaid')::int as unpaid
      from invoices
    `;
    const [pay] = await sql`
      select
        count(*)::int as n,
        coalesce(sum(amount), 0) as total,
        coalesce(sum(amount) filter (where status = 'expense'), 0) as expense_total,
        count(*) filter (where status = 'matched')::int as matched,
        count(*) filter (where status = 'approved')::int as approved,
        count(*) filter (where status = 'unmatched')::int as unmatched,
        count(*) filter (where status = 'expense')::int as expense,
        count(*) filter (where status in ('matched','unmatched'))::int as needs_action
      from payments
    `;
    const [ven] = await sql`select count(*)::int as n from vendors`;
    const monthly = await sql`
      with months as (
        select generate_series(
          date_trunc('month', current_date) - interval '5 months',
          date_trunc('month', current_date),
          interval '1 month'
        ) as m
      )
      select to_char(months.m, 'Mon') as label, coalesce(sum(p.amount), 0) as total
      from months
      left join payments p on date_trunc('month', coalesce(p.paid_on, p.created_at::date)) = months.m
      group by months.m order by months.m
    `;
    const [t] = await sql`
      select
        coalesce(sum(amount) filter (where date_trunc('month', coalesce(paid_on, created_at::date)) = date_trunc('month', current_date)), 0) as paid_this,
        coalesce(sum(amount) filter (where date_trunc('month', coalesce(paid_on, created_at::date)) = date_trunc('month', current_date) - interval '1 month'), 0) as paid_last,
        coalesce(sum(amount) filter (where status = 'expense' and date_trunc('month', coalesce(paid_on, created_at::date)) = date_trunc('month', current_date)), 0) as exp_this,
        coalesce(sum(amount) filter (where status = 'expense' and date_trunc('month', coalesce(paid_on, created_at::date)) = date_trunc('month', current_date) - interval '1 month'), 0) as exp_last
      from payments
    `;
    const [c] = await sql`
      select
        (select count(*) from invoices where date_trunc('month', created_at) = date_trunc('month', current_date))::int as inv_this,
        (select count(*) from invoices where date_trunc('month', created_at) = date_trunc('month', current_date) - interval '1 month')::int as inv_last,
        (select count(*) from payments where date_trunc('month', created_at) = date_trunc('month', current_date))::int as pay_this,
        (select count(*) from payments where date_trunc('month', created_at) = date_trunc('month', current_date) - interval '1 month')::int as pay_last,
        (select count(*) from vendors where date_trunc('month', created_at) = date_trunc('month', current_date))::int as ven_this,
        (select count(*) from vendors where date_trunc('month', created_at) = date_trunc('month', current_date) - interval '1 month')::int as ven_last
    `;
    const recentInvoices = await sql`select invoice_number, vendor_name, total, status, due_date from invoices order by created_at desc limit 6`;
    const recentPayments = await sql`select p.payee, p.amount, p.channel, p.status, p.match_score from payments p order by p.created_at desc limit 6`;
    const topVendors = await sql`
      select v.name, coalesce(sum(i.total), 0) as billed, count(i.id)::int as invoices
      from vendors v left join invoices i on i.vendor_id = v.id
      group by v.id order by billed desc limit 5
    `;
    const byCategory = await sql`
      select coalesce(nullif(category, ''), 'Uncategorized') as category,
             coalesce(sum(total), 0) as total,
             count(*)::int as count
      from invoices
      group by 1 order by total desc
    `;

    return NextResponse.json({
      invoices: inv,
      payments: pay,
      vendors: ven,
      monthly,
      trend: {
        paidThis: Number(t.paid_this),
        paidLast: Number(t.paid_last),
        expThis: Number(t.exp_this),
        expLast: Number(t.exp_last),
        invThis: c.inv_this,
        invLast: c.inv_last,
        payThis: c.pay_this,
        payLast: c.pay_last,
        venThis: c.ven_this,
        venLast: c.ven_last,
      },
      recentInvoices,
      recentPayments,
      topVendors,
      byCategory,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats." },
      { status: 500 }
    );
  }
}
