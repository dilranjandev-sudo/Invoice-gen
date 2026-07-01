import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { tdsRate, tdsLabel } from "@/lib/tds";

export const runtime = "nodejs";

// TDS payable per vendor, based on the section set on each vendor. Computed locally.
export async function GET() {
  try {
    const rows = await sql`
      select v.id, v.name, v.tds_section,
             coalesce(sum(i.total), 0) as billed,
             count(i.id)::int as bills
      from vendors v
      left join invoices i on i.vendor_id = v.id
      where v.tds_section is not null and v.tds_section <> 'none'
      group by v.id, v.name, v.tds_section
      order by sum(i.total) desc nulls last
    `;

    let totalTds = 0;
    let totalBase = 0;
    const bySectionMap: Record<string, { section: string; label: string; base: number; tds: number; vendors: number }> = {};
    const vendors = rows.map((r) => {
      const base = Number(r.billed) || 0;
      const rate = tdsRate(r.tds_section as string);
      const tds = Math.round(base * rate) / 100;
      totalTds += tds;
      totalBase += base;
      const key = r.tds_section as string;
      if (!bySectionMap[key]) bySectionMap[key] = { section: key, label: tdsLabel(key), base: 0, tds: 0, vendors: 0 };
      bySectionMap[key].base += base;
      bySectionMap[key].tds += tds;
      bySectionMap[key].vendors += 1;
      return { id: r.id, name: r.name, section: key, rate, base, tds, bills: r.bills };
    });

    return NextResponse.json({
      totalTds,
      totalBase,
      bySection: Object.values(bySectionMap).sort((a, b) => b.tds - a.tds),
      vendors,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
