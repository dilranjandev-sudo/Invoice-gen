import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", connect_timeout: 15 });

try {
  const [{ now }] = await sql`select now()`;
  console.log("CONNECTED:", now);

  await sql`create extension if not exists pgcrypto`;

  await sql`
    create table if not exists vendors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      gstin text,
      address text,
      phone text,
      email text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create unique index if not exists vendors_name_uidx on vendors (lower(name))`;

  await sql`
    create table if not exists invoices (
      id uuid primary key default gen_random_uuid(),
      vendor_id uuid references vendors(id) on delete set null,
      vendor_name text,
      vendor_gstin text,
      buyer text,
      buyer_gstin text,
      invoice_number text,
      invoice_date date,
      due_date date,
      place_of_supply text,
      currency text default 'INR',
      subtotal numeric(14,2),
      cgst numeric(14,2),
      sgst numeric(14,2),
      igst numeric(14,2),
      gst numeric(14,2),
      total numeric(14,2),
      amount_paid numeric(14,2),
      balance numeric(14,2),
      status text default 'unpaid',
      items jsonb,
      bank_name text,
      bank_account text,
      bank_ifsc text,
      raw jsonb,
      created_at timestamptz not null default now()
    )
  `;

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('vendors','invoices')
    order by table_name
  `;
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));
  console.log("DONE");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
