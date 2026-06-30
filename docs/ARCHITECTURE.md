# Invoice Gen — Architecture & Build Plan

> Gmail → AI extraction → draft review → professional PDF invoice → reply on the original thread.
> Stack: **Next.js (App Router, TypeScript)**. Database/hosting backend deferred (schema is written Postgres-first so it drops cleanly onto Supabase or any Postgres).

---

## 1. System Overview

```
                          ┌─────────────────────────────────────────────┐
                          │                Next.js App                    │
                          │  (App Router · Server Actions · Route Handlers)│
                          └───────────────┬───────────────────────────────┘
                                          │
   ┌──────────────┐   OAuth2     ┌────────┴────────┐    structured JSON   ┌──────────────┐
   │   Gmail API  │◄────────────►│   Sync Worker    │────────────────────►│  Claude API  │
   │ (read/reply) │   refresh    │ (cron, 5 min)    │   extract payment    │ (extraction) │
   └──────────────┘   token      └────────┬─────────┘                     └──────────────┘
                                          │
                          ┌───────────────┴───────────────┐
                          │          Postgres DB           │
                          │  emails · drafts · invoices ·  │
                          │  vendors · templates · logs ·  │
                          │  settings · gmail_accounts     │
                          └───────────────┬───────────────┘
                                          │
                              ┌───────────┴───────────┐
                              │   Object Storage       │
                              │  raw emails · PDFs ·   │
                              │  logos · attachments   │
                              └────────────────────────┘
```

The app is one Next.js deployment with three logical layers:

1. **UI** — Dashboard, review queue, invoice list, search, template designer, settings (React Server Components + client islands).
2. **Application services** — sync, extraction, draft creation, PDF rendering, Gmail reply, search. Implemented as server-only modules invoked by route handlers / server actions / cron.
3. **Persistence** — Postgres + object storage (PDFs, raw `.eml`, logos).

---

## 2. Technology Choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, TS, RSC) | Server-side Gmail/AI/PDF work + a fast dashboard in one deployable unit |
| UI kit | Tailwind CSS + shadcn/ui + lucide icons | Fast, consistent, themeable; matches "Minimal/Corporate/Modern" template vibe |
| Forms/validation | React Hook Form + **Zod** | Zod schemas double as the contract for AI JSON validation (FR-003) |
| Data fetching | Server Components + Server Actions; TanStack Query for client islands | Keeps secrets server-side; SWR-style UX where needed |
| Auth (app) | Auth.js (NextAuth) credentials/admin, or Supabase Auth if chosen | FR-017 admin login + sessions + "remember me" |
| Gmail | `googleapis` (OAuth2 + Gmail v1) | Read unread, fetch HTML body, send threaded reply with attachment |
| AI extraction | **Claude** (`claude-sonnet-4-6` default; `claude-opus-4-8` for hard cases) via `@anthropic-ai/sdk` with tool/`response_format` JSON | Strong structured extraction + confidence; cost-balanced |
| PDF | **Playwright/Chromium HTML→PDF** (primary) | Template designer is HTML/CSS (FR-011/012); A4, fonts, colors, logo, footer render exactly as previewed |
| Cron | Vercel Cron (or Supabase scheduled fn / external scheduler) | 5-min sync (FR-002) |
| Storage | Supabase Storage or S3-compatible | PDFs, raw emails, logos, attachments |
| Notifications | `sonner` toasts | FR-016 success/warning/failure/loading/retry |
| Queue/retry | DB-backed status + retry counter (lightweight) | FR-019 auto-retry without extra infra |

**Deferred backend decision:** DB and storage are abstracted behind a thin `db/` data-access layer and a `storage/` interface so Supabase vs. self-hosted Postgres is a config swap, not a rewrite.

---

## 3. Data Model

Postgres. All tables get `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. Money stored as `numeric(14,2)` + ISO `currency` code (never floats).

```
gmail_accounts        OAuth connection (one per admin) — FR-001
  email, refresh_token(enc), access_token(enc), token_expires_at,
  status [connected|disconnected|expired], connected_by, last_sync_at

emails                Raw synced Gmail messages — FR-002
  gmail_message_id (unique), gmail_thread_id, from, subject, snippet,
  body_html, body_text, received_at, raw_ref (storage path),
  status [new|processing|extracted|failed|processed], retry_count, error

extractions           AI output per email — FR-003
  email_id fk, vendor, amount numeric, currency, payment_date, payment_type,
  reference_number, raised_by, description, confidence numeric(5,2),
  status [extracted|needs_review], model, raw_json, created_at

drafts                Draft invoice from extraction — FR-004/005
  email_id fk, extraction_id fk, vendor_id fk, invoice_number, invoice_date,
  payment_date, amount, gst, currency, description, terms, notes,
  status [draft|reviewing|approved|cancelled]

invoices              Generated invoice — FR-006/008
  draft_id fk, invoice_number (unique), vendor_id fk, amount, gst, currency,
  invoice_date, payment_date, pdf_ref (storage), template_id fk,
  generated_by, generated_at, status [generated|sent], sent_at, thread_id

vendors               Vendor directory — FR-014
  company_name, gst, email (match key), phone, address, preferred_currency, notes

templates             Invoice templates — FR-011/012
  name, category [minimal|corporate|gst|modern|professional],
  is_default bool, design_json (logo, fonts, colors, margins, header,
  footer, terms, signature, html/handlebars body)

company_settings      Singleton — FR-013
  company_name, address, phone, email, gst, pan, website, logo_ref,
  invoice_prefix, default_currency, default_tax

activity_logs         Audit trail — FR-015
  user_id, action [email_synced|ai_extracted|draft_edited|invoice_generated
  |invoice_sent|settings_changed|...], entity_type, entity_id, metadata jsonb, created_at

users                 Admin accounts — FR-017 (role for FR-018 future)
  email, password_hash, role [admin|finance|reviewer|viewer], remember_token
```

**Key relationships:** `email 1─1 extraction 1─1 draft 1─1 invoice`; `vendor 1─* drafts/invoices`; `template 1─* invoices`. Vendor auto-match is by normalized `email`/`gst` (FR-014).

---

## 4. Core Flows

### 4.1 Gmail connect (FR-001)
OAuth2 consent → store encrypted refresh token → background access-token refresh on `expires_at`. Status badge: ✅ Connected / ❌ Disconnected / ⚠ Expired (refresh failed). Reconnect re-runs consent; disconnect revokes + clears tokens.

### 4.2 Sync loop (FR-002) — every 5 min
1. Cron hits `POST /api/sync`.
2. List **unread** messages since `last_sync_at`; skip `gmail_message_id` already stored (dedupe).
3. Persist raw email + HTML body → `emails(status=new)`.
4. Enqueue extraction. Update `last_sync_at`. Log `email_synced`.
Target < 10 s/run (FR-020) → batch + cap per run, continue next tick.

### 4.3 AI extraction (FR-003)
- Input: cleaned HTML→text body + sender metadata.
- Claude call forced to a **Zod-derived JSON schema** (vendor, amount, currency, payment_date, payment_type, reference_number, raised_by, status, description, **confidence_score**).
- Validate with Zod. `confidence < 85` ⇒ `status = needs_review`.
- `emails.status = extracted` (or `failed` → retry, FR-019). Log `ai_extracted`.

### 4.4 Draft creation (FR-004)
On successful extraction, create `draft` (status=draft). Invoice number = `company_settings.invoice_prefix` + sequence. Auto-match/attach vendor (FR-014).

### 4.5 Manual review (FR-005)
Review screen with editable Vendor/Amount/GST/Invoice#/Dates/Description/Terms/Notes. Actions: **Save** (persist, log `draft_edited`), **Cancel** (status=cancelled), **Generate Invoice** (→ 4.6).

### 4.6 Invoice generation (FR-006)
Render chosen template (Handlebars/JSX → HTML) → Playwright Chromium → **A4 high-quality PDF** with logo, GST details, footer, terms, invoice number, generated time/by. Store `pdf_ref`, create `invoices(status=generated)`. Target < 5 s (FR-020). Log `invoice_generated`.

### 4.7 Gmail reply (FR-007)
Reply on the original **thread** (`In-Reply-To`/`References`), custom template subject/body, attach `Invoice.pdf` (MIME multipart). `invoices.status=sent`. Log `invoice_sent`.

### 4.8 Search (FR-009)
Global search across vendor / invoice# / reference# / email / amount / status / date. Postgres trigram + GIN indexes (instant per FR-020); optional `tsvector` for body text.

---

## 5. Module / Folder Layout

```
app/
  (auth)/login
  (app)/
    dashboard/                 # FR-010
    review/[draftId]/          # FR-005
    invoices/  invoices/[id]/  # FR-008
    search/                    # FR-009
    templates/  templates/[id]/designer/   # FR-011/012
    vendors/                   # FR-014
    settings/  settings/company  settings/gmail   # FR-013, FR-001
    activity/                  # FR-015
  api/
    sync/        route.ts      # cron entry (FR-002)
    extract/     route.ts      # FR-003
    invoices/generate/route.ts # FR-006
    gmail/reply/ route.ts      # FR-007
    auth/google/callback/route.ts
lib/
  gmail/      oauth.ts  sync.ts  reply.ts
  ai/         extract.ts  schema.ts        # Zod + Claude
  pdf/        render.ts  templates/
  db/         client.ts  repositories/     # backend-agnostic DAL
  storage/    index.ts                     # PDF/raw/logo
  search/     query.ts
  logging/    activity.ts
  notify/     toast.ts
components/ ui/ (shadcn) + feature components
```

---

## 6. Cross-cutting

- **Error handling & retry (FR-019):** every async stage writes `status` + `retry_count` + `error`; cron re-picks `failed` rows with backoff (AI timeout, sync fail, PDF fail, DB fail). Surface as toasts.
- **Performance (FR-020):** dashboard < 2 s (RSC + indexed aggregate queries), invoice < 5 s, sync < 10 s, search instant (GIN/trigram).
- **Notifications (FR-016):** `sonner` for success/warning/failure/loading/retry.
- **Activity logs (FR-015):** single `logActivity(user, action, entity, meta)` helper called at every state transition.
- **Security:** refresh tokens encrypted at rest; secrets server-only; admin-gated routes via middleware.
- **Roles (FR-018, future):** `users.role` column reserved; enforcement deferred.

---

## 7. Build Phases

| Phase | Delivers | FRs |
|---|---|---|
| **0. Scaffold** | Next.js + TS + Tailwind + shadcn, lint, env, DAL/storage interfaces, admin auth | FR-017 |
| **1. Gmail + sync** | OAuth connect/disconnect/reconnect, status badges, 5-min sync, raw store, dedupe | FR-001, FR-002 |
| **2. AI + drafts** | Claude extraction w/ Zod + confidence, needs-review, draft creation | FR-003, FR-004 |
| **3. Review + PDF** | Review/edit UI, template render, A4 PDF generation, storage | FR-005, FR-006, FR-008 |
| **4. Reply** | Threaded Gmail reply w/ PDF attachment, custom templates | FR-007 |
| **5. Dashboard + search** | Dashboard cards/quick actions, global search | FR-009, FR-010 |
| **6. Templates + settings** | Template list + designer (live preview), company settings, vendors | FR-011, FR-012, FR-013, FR-014 |
| **7. Hardening** | Activity logs UI, toasts everywhere, retry/error handling, perf passes | FR-015, FR-016, FR-019, FR-020 |
| **Future** | Attachments download, QR code, forgot-password, user roles | FR-002, FR-006, FR-017, FR-018 |

---

## 8. Open Decisions (need input before/at Phase 0–1)

1. **Backend:** new Supabase project vs. existing `ap-automation` vs. self-hosted Postgres. (Deferred — affects auth + storage glue, not app structure.)
2. **AI model/budget:** default `claude-sonnet-4-6` for extraction; escalate to `claude-opus-4-8` only on low confidence? Confirm cost tolerance.
3. **PDF engine:** Playwright/Chromium (template-accurate, heavier) vs. `@react-pdf/renderer` (lighter, less CSS fidelity). Recommendation: Playwright for the designer fidelity FR-012 needs.
4. **Hosting/cron:** Vercel (Cron built-in) vs. self-host (external scheduler).
5. **Single admin vs. multi-user from day one** (FR-017 now, FR-018 later).
```

