import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadUrl() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(root, f), "utf8");
      const m = txt.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  throw new Error("DATABASE_URL not found");
}

const sql = postgres(loadUrl(), { ssl: "require", prepare: false, max: 1, connect_timeout: 30 });

try {
  await sql`
    create table if not exists purchase_orders (
      id             uuid primary key default gen_random_uuid(),
      po_number      text,
      vendor_name    text,
      vendor_email   text,
      vendor_gstin   text,
      vendor_address text,
      order_date     date,
      expected_date  date,
      currency       text default 'INR',
      items          jsonb,
      subtotal       numeric(14,2),
      gst            numeric(14,2),
      total          numeric(14,2),
      notes          text,
      status         text default 'draft',   -- draft | sent | received | closed
      matched_invoice_id uuid references invoices(id) on delete set null,
      created_at     timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists recurring_expenses (
      id           uuid primary key default gen_random_uuid(),
      name         text not null,
      payee        text,
      category     text,
      amount       numeric(14,2),
      currency     text default 'INR',
      frequency    text default 'monthly',   -- monthly | quarterly | yearly
      next_due     date,
      last_paid_on date,
      notes        text,
      active       boolean default true,
      created_at   timestamptz not null default now()
    )
  `;
  const t = await sql`select table_name from information_schema.tables where table_name in ('purchase_orders','recurring_expenses') order by table_name`;
  console.log("OK — tables:", t.map((r) => r.table_name).join(", "));
} catch (e) {
  console.error("MIGRATION FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
