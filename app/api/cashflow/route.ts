import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Cash outflow: what you owe & when, plus monthly burn. All from your own data.
export async function GET() {
  try {
    const bills = await sql`
      select id, invoice_number, vendor_name, total, amount_paid, due_date, invoice_date, status
      from invoices
      where status is distinct from 'paid'
      order by coalesce(due_date, invoice_date) asc nulls last
    `;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 86400000;
    const buckets = {
      overdue: { label: "Overdue", amount: 0, count: 0, bills: [] as unknown[] },
      week: { label: "Due this week", amount: 0, count: 0, bills: [] as unknown[] },
      month: { label: "Due this month", amount: 0, count: 0, bills: [] as unknown[] },
      later: { label: "Later / no date", amount: 0, count: 0, bills: [] as unknown[] },
    };
    let outstanding = 0;
    for (const b of bills) {
      const due = Number(b.total || 0) - Number(b.amount_paid || 0);
      if (due <= 0) continue;
      outstanding += due;
      const d = b.due_date ? new Date(b.due_date as string).getTime() : null;
      let key: keyof typeof buckets = "later";
      if (d != null) {
        const diff = Math.round((d - today) / day);
        if (diff < 0) key = "overdue";
        else if (diff <= 7) key = "week";
        else if (diff <= 31) key = "month";
        else key = "later";
      }
      buckets[key].amount += due;
      buckets[key].count += 1;
      if (buckets[key].bills.length < 8) {
        buckets[key].bills.push({
          id: b.id, invoice_number: b.invoice_number, vendor_name: b.vendor_name, due, due_date: b.due_date,
        });
      }
    }

    // Monthly burn (payments) — last 6 months
    const burn = await sql`
      with months as (
        select generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') as m
      )
      select to_char(months.m, 'Mon') as label, coalesce(sum(p.amount), 0) as amount
      from months
      left join payments p on date_trunc('month', coalesce(p.paid_on, p.created_at::date)) = months.m
      group by months.m order by months.m
    `;
    const [avg] = await sql`
      select coalesce(avg(s.amt), 0) as avg_burn from (
        select date_trunc('month', coalesce(paid_on, created_at::date)) as mth, sum(amount) as amt
        from payments where coalesce(paid_on, created_at::date) >= current_date - interval '3 months'
        group by 1
      ) s
    `;

    return NextResponse.json({
      outstanding,
      buckets,
      burn,
      avgBurn: Number(avg.avg_burn) || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
