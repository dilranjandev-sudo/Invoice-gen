import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { scoreMatch } from "@/lib/match";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    await sql`delete from payments where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    // --- Manually link a payment to a bill --------------------------------
    if (b.action === "link") {
      if (!b.invoiceId) return NextResponse.json({ error: "Missing invoiceId." }, { status: 400 });
      const [p] = await sql`select payee, amount, paid_on from payments where id = ${b.id}`;
      const [inv] = await sql`select id, vendor_name, total, invoice_date, due_date from invoices where id = ${b.invoiceId}`;
      if (!inv) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
      const score = p
        ? scoreMatch(
            { id: b.id, payee: p.payee, amount: p.amount, paid_on: p.paid_on },
            { id: inv.id, vendor_name: inv.vendor_name, total: inv.total, invoice_date: inv.invoice_date, due_date: inv.due_date }
          )
        : null;
      await sql`
        update payments
        set matched_invoice_id = ${b.invoiceId}, match_score = ${score}, type = 'bill', category = null, status = 'matched'
        where id = ${b.id}
      `;
      return NextResponse.json({ ok: true, status: "matched", score });
    }

    // --- Unlink from a bill (back to needing action) ----------------------
    if (b.action === "unlink") {
      await sql`
        update payments
        set matched_invoice_id = null, match_score = null, status = 'unmatched'
        where id = ${b.id}
      `;
      return NextResponse.json({ ok: true, status: "unmatched" });
    }

    // --- Mark as a direct expense (salary/rent/tax…) — no bill needed -----
    if (b.action === "expense") {
      await sql`
        update payments set
          type = 'expense',
          category = ${b.category ? String(b.category).trim() : "Other"},
          note = ${b.note ? String(b.note).trim() : null},
          matched_invoice_id = null,
          match_score = null,
          status = 'expense'
        where id = ${b.id}
      `;
      return NextResponse.json({ ok: true, status: "expense" });
    }

    // --- Convert an expense back to a normal bill payment -----------------
    if (b.action === "bill") {
      await sql`
        update payments set type = 'bill', category = null, note = null, status = 'unmatched'
        where id = ${b.id}
      `;
      return NextResponse.json({ ok: true, status: "unmatched" });
    }

    // --- Plain field edit -------------------------------------------------
    const amt = b.amount === "" || b.amount == null ? null : Number(b.amount);
    await sql`
      update payments set
        payee = ${b.payee ? String(b.payee).trim() : null},
        amount = ${amt},
        status = ${b.status || "unmatched"}
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
      select
        p.*,
        a.email as source_email,
        i.invoice_number as matched_invoice_no,
        i.total as matched_invoice_total
      from payments p
      left join gmail_accounts a on a.id = p.gmail_account_id
      left join invoices i on i.id = p.matched_invoice_id
      order by coalesce(p.paid_on, p.created_at::date) desc, p.created_at desc
      limit 200
    `;
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load payments." },
      { status: 500 }
    );
  }
}
