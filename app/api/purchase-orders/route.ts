import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function totals(items: any[]) {
  let subtotal = 0;
  let gst = 0;
  for (const it of items || []) {
    const amt = Number(it.amount) || 0;
    subtotal += amt;
    gst += amt * ((Number(it.gst) || 0) / 100);
  }
  return { subtotal: Math.round(subtotal * 100) / 100, gst: Math.round(gst * 100) / 100, total: Math.round((subtotal + gst) * 100) / 100 };
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const [po] = await sql`select * from purchase_orders where id = ${id} limit 1`;
      if (!po) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json(po);
    }
    const rows = await sql`select * from purchase_orders order by created_at desc limit 200`;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const items = Array.isArray(b.items) ? b.items.filter((i: { name?: string; amount?: unknown }) => i && (i.name || i.amount)) : [];
    const t = totals(items);
    const year = (str(b.orderDate)?.slice(0, 4)) || String(new Date().getFullYear());
    const [c] = await sql`select count(*)::int as n from purchase_orders where po_number like ${"PO-" + year + "-%"}`;
    const poNumber = `PO-${year}-${String((c.n || 0) + 1).padStart(3, "0")}`;

    const [po] = await sql`
      insert into purchase_orders (
        po_number, vendor_name, vendor_email, vendor_gstin, vendor_address,
        order_date, expected_date, currency, items, subtotal, gst, total, notes, status
      ) values (
        ${poNumber}, ${str(b.vendorName)}, ${str(b.vendorEmail)}, ${str(b.vendorGstin)}, ${str(b.vendorAddress)},
        ${str(b.orderDate)}, ${str(b.expectedDate)}, ${str(b.currency) ?? "INR"},
        ${sql.json(JSON.parse(JSON.stringify(items)))}, ${t.subtotal}, ${t.gst}, ${t.total}, ${str(b.notes)}, 'draft'
      ) returning *
    `;
    return NextResponse.json(po);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    // Quick status change (e.g. mark received / closed)
    if (b.action === "status") {
      await sql`update purchase_orders set status = ${str(b.status) ?? "draft"} where id = ${b.id}`;
      return NextResponse.json({ ok: true });
    }

    const items = Array.isArray(b.items) ? b.items.filter((i: { name?: string; amount?: unknown }) => i && (i.name || i.amount)) : [];
    const t = totals(items);
    await sql`
      update purchase_orders set
        vendor_name = ${str(b.vendorName)}, vendor_email = ${str(b.vendorEmail)},
        vendor_gstin = ${str(b.vendorGstin)}, vendor_address = ${str(b.vendorAddress)},
        order_date = ${str(b.orderDate)}, expected_date = ${str(b.expectedDate)}, currency = ${str(b.currency) ?? "INR"},
        items = ${sql.json(JSON.parse(JSON.stringify(items)))}, subtotal = ${t.subtotal}, gst = ${t.gst}, total = ${t.total},
        notes = ${str(b.notes)}
      where id = ${b.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from purchase_orders where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
