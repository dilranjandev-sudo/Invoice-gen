import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", connect_timeout: 15 });

try {
  await sql`
    create table if not exists gmail_accounts (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      refresh_token text,
      access_token text,
      token_expiry timestamptz,
      scope text,
      status text not null default 'connected',
      last_sync_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists payments (
      id uuid primary key default gen_random_uuid(),
      gmail_account_id uuid references gmail_accounts(id) on delete set null,
      gmail_message_id text unique,
      payee text,
      amount numeric(14,2),
      currency text default 'INR',
      paid_on date,
      reference text,
      utr text,
      mode text,
      channel text,
      account_detail text,
      paid_by text,
      status text default 'unmatched',
      matched_invoice_id uuid references invoices(id) on delete set null,
      subject text,
      snippet text,
      raw jsonb,
      created_at timestamptz not null default now()
    )
  `;

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and table_name in ('gmail_accounts','payments') order by table_name
  `;
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));
  console.log("DONE");
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
