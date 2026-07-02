@AGENTS.md

# PayRecord — Project Guide (for any dev or AI agent)

This file is a self-contained handoff. Read it fully before making changes.
Any AI agent (Claude, Cursor, etc.) or developer on any machine can use this to
continue the project.

## 1. What this is
**PayRecord** — an AI-powered **Accounts-Payable (AP) automation** web app for
**Biqadx Private Limited**. It records payments the company *makes to vendors*.

Core flow: **Gmail sync → AI reads bills (PDF) & payment emails → auto-match
payment↔bill → review → approve → email the vendor a confirmation.** Plus GST/TDS
reports, cash flow, quotations, purchase orders (3-way match), recurring
expenses, bank reconciliation, an AI copilot, autopilot & anomaly detection.

## 2. Quick start
```bash
git clone https://github.com/dilranjandev-sudo/Invoice-gen.git
cd Invoice-gen
npm install
cp .env.example .env.local     # then fill in values (see §3)
npm run dev                    # http://localhost:3000
```
Login (dev default): `support@biqadx.com` / `payrecord123`.
Build: `npm run build` · Start: `npm run start` · Typecheck: `npx tsc --noEmit`.

> A fresh database needs the schema — run `scripts/schema.sql` in the Supabase
> SQL editor, then the `scripts/migrate-*.mjs` files (see §6).

## 3. Environment variables (.env.local)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres **transaction pooler** URL (port 6543). Use the pooler host, not the direct host. |
| `GROQ_API_KEY` | Primary AI (invoices, payments, copilot, statement, anomaly). Free at console.groq.com/keys |
| `GEMINI_API_KEY` | Optional AI fallback |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth (scopes: gmail.readonly, gmail.send, userinfo.email) |
| `GOOGLE_REDIRECT_URI` | Must exactly match the OAuth client (`<APP_URL>/api/gmail/callback`) |
| `APP_URL` | Base URL (localhost in dev, `https://invoice.biqadx.com` in prod) |
| `COMPANY_NAME` | Shown in vendor emails |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | The single login account |
| `AUTH_SECRET` | Long random string — signs the session cookie |

## 4. Tech stack
- **Next.js 16.2.9** (App Router, Turbopack) — ⚠️ modified fork, see AGENTS.md. Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- **React 19**, **TypeScript**, **Tailwind CSS v4** (tokens in `app/globals.css`)
- **postgres** (postgres.js) → Supabase Postgres
- **groq-sdk** (llama-3.3-70b / 3.1-8b / llama-4-scout vision), **@google/genai** (fallback)
- **googleapis** (Gmail), **pdf-parse** (PDF text), **sonner** (toasts), **lucide-react** (icons)

## 5. Architecture & conventions (IMPORTANT)
- **`proxy.ts`, NOT `middleware.ts`** — this Next fork renamed the convention. It guards all pages (→`/login`) & APIs (→401) except `/login`, `/api/auth/*`, `/api/logo`, `/api/health`, and the manifest/icon/sw.
- **`lib/db.ts`** — one shared postgres client (global singleton). Tuned for the Supabase pgbouncer pooler: `prepare:false`, `idle_timeout:10` (short, so stale sockets aren't reused → they cause ~30s hangs), `max:8`.
- **Query pattern:** in hot endpoints (e.g. `/api/stats`) run queries **sequentially** on one warm connection. Firing many in parallel makes the pooler open many cold connections → slow/flaky on the free tier.
- **`instrumentation.ts`** — runs on server boot: pings the DB every 3 min (keep-warm) and triggers `runRecurringReminders()` (self-guards to once/day).
- **Auth** — signed HMAC session cookie via Web Crypto (`lib/auth.ts`), edge+node safe. **TOTP 2FA** in `lib/totp.ts` (RFC-6238, validated). Owner-only for now.
- **Components:** shared UI in `components/ui/*` (Button, Card, Input, Drawer, Skeleton, badge…). Layout in `components/layout/*` (sidebar with collapsible menu/submenu, topbar, mobile-menu). Design is the **CRMS red theme** (`--primary:#e41f07`, Golos Text font).
- **Migrations:** temporary `scripts/migrate-*.mjs` node scripts that read `DATABASE_URL` from `.env.local` and `alter/create table if not exists`. Run with `node scripts/<name>.mjs`. Keep them idempotent.

## 6. Database (Supabase Postgres)
Base schema: `scripts/schema.sql`. Key tables:
`vendors`, `invoices` (bills, +category/gmail_message_id/rule_notes), `payments`
(+type/category/note/reconciled), `gmail_accounts`, `scanned_emails`, `rules`,
`rejected_bills`, `app_settings` (key/value — auto_sync, autopilot, 2FA secret,
company_logo, reminder flags…), `quotations`, `subscriptions`, `documents`,
`purchase_orders` (+matched_invoice_id for 3-way match), `recurring_expenses`.
Migration scripts already run: `migrate-payments`, `migrate-purchase-recurring`,
`migrate-reconcile`.

## 7. Feature map (routes)
- `/dashboard` — KPIs (outstanding, paid, to-review, expenses), cash-out chart, payables, top vendors, category, recent. Loads `/api/stats`.
- `/copilot` — **AI chat** over live data (`/api/copilot`, Groq).
- `/review` — link payment↔bill or mark expense, approve; shows **anomaly flags**.
- `/invoices` (Bills), `/payments`, `/reconcile` (**bank statement AI reconciliation**), `/purchasing` (**Purchase Orders** + 3-way match, detail at `/purchasing/[id]`), `/vendors`.
- `/quotations` (+`/[id]` printable doc), `/gst`, `/tds`, `/cashflow`.
- `/recurring` (**rent/subscriptions + reminder emails**), `/subscriptions`, `/documents`, `/workflow`, `/connectors` (Gmail), `/rules`, `/settings`.
- Settings has: Logo, **AI Automation** (autopilot + threshold + reminders), **Two-factor auth**, Auto-sync & fetch window, company profile.

## 8. Automation summary
- **Auto-sync** (Settings toggle) — pulls payments+bills from Gmail, matches.
- **Autopilot** (`lib/autopilot.ts`, off by default) — auto-approves matched payments ≥ threshold with **no high-severity anomaly**; emails vendor. Runs after each sync.
- **Anomaly** (`lib/anomaly.ts`) — amount vs vendor average, new vendor, missing GSTIN, duplicate.
- **Recurring reminders** (`lib/reminders.ts`) — daily email digest of due items.
- **3-way match** — a saved bill auto-links to an open PO (same vendor, ±5%).
- **Keep-warm** — `instrumentation.ts` (fixes DB cold-starts).

## 9. Deploy (Hostinger native Next.js)
Connect the GitHub repo in hPanel → Node.js app → it runs `next build` + `next start`.
Set all §3 env vars there, with `APP_URL=https://invoice.biqadx.com` and the
matching `GOOGLE_REDIRECT_URI`. Add that redirect URI + JS origin in Google Cloud
OAuth. Details in `DEPLOY-HOSTINGER.md`.

## 10. Known gotchas
- **Google Fonts fetch fails offline** → `next build` errors on Geist. Only a network issue; dev + Hostinger (online) are fine.
- **DB cold-start / throttle** — first request after idle can be slow; hammering the free-tier pooler can throttle it for minutes. Keep-warm + sequential queries mitigate. Don't stress-test the DB.
- **Windows line endings** — git warns `LF will be replaced by CRLF`; harmless.
- **2FA lockout recovery** — if the authenticator is lost: `delete from app_settings where key in ('owner_2fa_enabled','owner_2fa_secret','owner_2fa_pending');` in Supabase.
- Company/bank details in quotation & PO documents are currently **hardcoded** (in the `[id]` pages) — making them editable in Settings is a good next task.

## 11. How to add a feature (recipe)
1. If it needs storage: add a `scripts/migrate-<x>.mjs`, run it, and note the table here.
2. Add API route(s) under `app/api/<x>/route.ts` (`export const runtime = "nodejs"`).
3. Add page(s) under `app/(app)/<x>/page.tsx` — reuse `components/ui/*` + `PageHeader` + `Skeleton`.
4. Add a sidebar entry in `components/layout/sidebar.tsx` (the `sections` array).
5. `npx tsc --noEmit` must pass; then commit. Push needs a GitHub token with write access to the repo.
