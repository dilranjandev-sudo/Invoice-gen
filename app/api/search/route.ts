import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/search?q= — quick global search across bills, vendors, payments.
export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    if (q.length < 1) return NextResponse.json({ results: [] });
    const like = `%${q}%`;

    const [bills, vendors, payments] = await Promise.all([
      sql`
        select id, invoice_number, vendor_name, total
        from invoices
        where invoice_number ilike ${like} or vendor_name ilike ${like}
        order by created_at desc limit 5
      `,
      sql`
        select id, name, gstin
        from vendors
        where name ilike ${like} or gstin ilike ${like}
        order by name limit 5
      `,
      sql`
        select id, payee, amount
        from payments
        where payee ilike ${like} or reference ilike ${like} or utr ilike ${like}
        order by created_at desc limit 5
      `,
    ]);

    const results = [
      ...bills.map((b) => ({
        type: "Bill",
        title: `#${b.invoice_number || "—"} · ${b.vendor_name || "Unknown"}`,
        sub: b.total != null ? Number(b.total) : null,
        href: "/invoices",
      })),
      ...vendors.map((v) => ({
        type: "Vendor",
        title: v.name,
        sub: v.gstin || null,
        href: "/vendors",
      })),
      ...payments.map((p) => ({
        type: "Payment",
        title: p.payee || "Payment",
        sub: p.amount != null ? Number(p.amount) : null,
        href: "/payments",
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed." }, { status: 500 });
  }
}
