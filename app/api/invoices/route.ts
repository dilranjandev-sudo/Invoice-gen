import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`update payments set matched_invoice_id = null, match_score = null, status = 'unmatched' where matched_invoice_id = ${id}`;
    await sql`delete from invoices where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`
      update invoices set
        vendor_name = ${str(b.vendor)}, vendor_gstin = ${str(b.vendorGstin)},
        invoice_number = ${str(b.invoiceNumber)}, invoice_date = ${str(b.invoiceDate)},
        due_date = ${str(b.dueDate)}, place_of_supply = ${str(b.placeOfSupply)},
        currency = ${str(b.currency) ?? "INR"}, subtotal = ${num(b.subtotal)},
        gst = ${num(b.gst)}, total = ${num(b.total)}, status = ${str(b.status) ?? "unpaid"}
      where id = ${b.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rows = await sql`
      select * from invoices order by created_at desc limit 200
    `;
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load invoices.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();

    // Upsert vendor when requested
    let vendorId: string | null = null;
    const vendorName = str(b.vendor);
    if (b.saveVendor && vendorName) {
      const [v] = await sql`
        insert into vendors (name, gstin, address, phone, email)
        values (${vendorName}, ${str(b.vendorGstin)}, ${str(b.vendorAddress)}, ${str(b.vendorPhone)}, ${str(b.vendorEmail)})
        on conflict (lower(name)) do update
          set gstin = coalesce(excluded.gstin, vendors.gstin),
              address = coalesce(excluded.address, vendors.address),
              phone = coalesce(excluded.phone, vendors.phone),
              email = coalesce(excluded.email, vendors.email)
        returning id
      `;
      vendorId = v.id;
    }

    const [inv] = await sql`
      insert into invoices (
        vendor_id, vendor_name, vendor_gstin, buyer, buyer_gstin,
        invoice_number, invoice_date, due_date, place_of_supply, currency,
        subtotal, cgst, sgst, igst, gst, total, amount_paid, balance, status,
        items, bank_name, bank_account, bank_ifsc, raw
      ) values (
        ${vendorId}, ${vendorName}, ${str(b.vendorGstin)}, ${str(b.buyer)}, ${str(b.buyerGstin)},
        ${str(b.invoiceNumber)}, ${str(b.invoiceDate)}, ${str(b.dueDate)}, ${str(b.placeOfSupply)}, ${str(b.currency) ?? "INR"},
        ${num(b.subtotal)}, ${num(b.cgst)}, ${num(b.sgst)}, ${num(b.igst)}, ${num(b.gst)}, ${num(b.total)}, ${num(b.amountPaid)}, ${num(b.balance)}, ${str(b.status) ?? "unpaid"},
        ${b.items ? sql.json(b.items) : null}, ${str(b.bankName)}, ${str(b.bankAccount)}, ${str(b.bankIfsc)}, ${b.raw ? sql.json(b.raw) : null}
      )
      returning *
    `;
    return NextResponse.json(inv);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
