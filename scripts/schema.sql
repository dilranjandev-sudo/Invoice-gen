-- ============================================================================
-- PayRecord — complete database schema
-- Run this ONCE on a fresh Supabase / Postgres database.
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   (Or: psql "<your DATABASE_URL>" -f scripts/schema.sql)
--
-- It is idempotent — safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Vendors — the companies you pay
-- ---------------------------------------------------------------------------
create table if not exists vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  gstin       text,
  address     text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);
create unique index if not exists vendors_name_uidx on vendors (lower(name));

-- ---------------------------------------------------------------------------
-- Invoices / Bills — extracted from uploaded PDFs by AI
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid references vendors(id) on delete set null,
  vendor_name     text,
  vendor_gstin    text,
  buyer           text,
  buyer_gstin     text,
  invoice_number  text,
  invoice_date    date,
  due_date        date,
  place_of_supply text,
  currency        text default 'INR',
  subtotal        numeric(14,2),
  cgst            numeric(14,2),
  sgst            numeric(14,2),
  igst            numeric(14,2),
  gst             numeric(14,2),
  total           numeric(14,2),
  amount_paid     numeric(14,2),
  balance         numeric(14,2),
  status          text default 'unpaid',   -- unpaid | partial | paid
  items           jsonb,
  bank_name       text,
  bank_account    text,
  bank_ifsc       text,
  raw             jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gmail accounts — connected via OAuth, used to read payment emails & send
-- the payment-confirmation email to vendors.
-- ---------------------------------------------------------------------------
create table if not exists gmail_accounts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  refresh_token text,
  access_token  text,
  token_expiry  timestamptz,
  scope         text,
  status        text default 'connected',  -- connected | disconnected
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payments — payment-confirmation emails synced from Gmail, AI-extracted,
-- then matched to an invoice.
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  gmail_account_id   uuid references gmail_accounts(id) on delete set null,
  gmail_message_id   text unique,          -- dedupe key (one row per email)
  payee              text,
  amount             numeric(14,2),
  currency           text default 'INR',
  paid_on            date,
  reference          text,
  utr                text,
  mode               text,                 -- UPI / NEFT / IMPS / RTGS / Card …
  channel            text,
  account_detail     text,
  status             text default 'unmatched', -- unmatched | matched | approved | expense
  type               text default 'bill',      -- bill (needs a match) | expense (salary/rent/tax — no bill)
  category           text,                     -- expense category when type = 'expense'
  note               text,                     -- free note (e.g. employee & month for salary)
  subject            text,
  snippet            text,
  matched_invoice_id uuid references invoices(id) on delete set null,
  match_score        int,                  -- 0–100 confidence from lib/match.ts
  raw                jsonb,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scanned emails — every Gmail message we've already looked at (payment or
-- not). Stops us re-sending the same email to the AI and burning quota.
-- ---------------------------------------------------------------------------
create table if not exists scanned_emails (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_account_id uuid references gmail_accounts(id) on delete set null,
  created_at       timestamptz not null default now()
);
