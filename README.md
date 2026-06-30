# PayRecord — AP Automation

PayRecord is an **accounts-payable (AP) automation** app. It keeps a clean record
of the payments your company **makes to vendors** — with as few manual clicks as
possible.

**The flow, end to end:**

1. A bill / invoice arrives → you **upload the PDF**, and AI reads every field
   (vendor, GSTIN, amounts, taxes, dates, bank details).
2. Payment-confirmation emails (UPI / NEFT / IMPS, "amount debited", etc.) are
   **auto-synced from Gmail** every few minutes and AI extracts the payment.
3. AI **matches** each payment to the right bill (amount + vendor + date → a 0–100
   confidence score).
4. You review the matches and **approve with one click**.
5. On approval, a **professional payment-confirmation email** is sent to the vendor
   from your connected Gmail.

Built with **Next.js 16 (App Router, Turbopack) + React 19 + TypeScript +
Tailwind CSS v4**, **Supabase Postgres**, **Groq / Gemini** for AI, and the
**Gmail API** for sync + sending.

---

## What's inside

| Page (route) | What it does |
|---|---|
| **Home** (`/dashboard`) | Live KPIs — total paid, payments, vendors, bills; charts; recent activity. |
| **To Review** (`/review`) | Matched Bill ↔ Payment cards. *Approve & mark paid* or *Not a match*. The one manual step. |
| **Bills** (`/invoices`) | Upload a bill → AI extract → review. Table with edit/delete. |
| **Payments** (`/payments`) | Synced payments, which Gmail they came from, match score. *Sync* / *Run AI Match*. |
| **Vendors** (`/vendors`) | Vendor directory (auto-created from extracted bills). |
| **Gmail** (`/connectors`) | Connect / disconnect Gmail accounts; manual sync. |
| **Settings** (`/settings`) | App + company settings. |

---

## Tech stack

- **Next.js 16.2.9** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind CSS v4** (`@import "tailwindcss"`, `@theme inline`)
- **Supabase Postgres** via [`postgres`](https://github.com/porsager/postgres) (postgres.js)
- **Groq SDK** (`llama-3.1-8b-instant`, JSON mode) — primary AI; **Gemini** fallback
- **`pdf-parse`** for local PDF text extraction
- **`googleapis`** — Gmail OAuth (read + send)
- **sonner** (toasts), **lucide-react** (icons)

---

## Run it on a new laptop

### 0. Prerequisites
- **Node.js 20+** and npm — https://nodejs.org
- **Git** — https://git-scm.com
- Accounts for: **Supabase** (free), **Groq** (free), and a **Google Cloud** project for Gmail.

### 1. Clone & install
```bash
git clone https://github.com/dilranjandev-sudo/Invoice-gen.git
cd Invoice-gen
npm install
```

### 2. Set up the database (Supabase)
1. Create a project at https://supabase.com (free tier is fine).
2. Open **SQL Editor**, paste the contents of [`scripts/schema.sql`](scripts/schema.sql),
   and **Run**. This creates all 5 tables (`vendors`, `invoices`, `gmail_accounts`,
   `payments`, `scanned_emails`).
3. Get your connection string: **Project Settings → Database → Connection string →
   Transaction pooler** (port **6543**). Use the **pooler** host — the direct host is
   IPv6-only and won't resolve on most networks.

> **Sharing one database between laptops?** If you both use the *same*
> `DATABASE_URL`, you don't need to run `schema.sql` again — the tables already exist.

### 3. Configure environment variables
```bash
cp .env.example .env.local          # macOS / Linux
# Copy-Item .env.example .env.local # Windows PowerShell
```
Open `.env.local` and fill in every value. See the comments in
[`.env.example`](.env.example) for exactly where each key comes from. Summary:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Database → Connection string (pooler, 6543) |
| `GROQ_API_KEY` | https://console.groq.com/keys (free) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (optional fallback) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client (see step 4) |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/gmail/callback` |
| `APP_URL` | `http://localhost:3000` |
| `COMPANY_NAME` | Your company name (shown in vendor emails) |

### 4. Set up Gmail (Google OAuth)
1. https://console.cloud.google.com → create / pick a project.
2. **APIs & Services → Library →** enable **Gmail API**.
3. **OAuth consent screen** → User type **External** → add your own Google account
   under **Test users** (required while the app is unverified).
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   Add this exact **Authorized redirect URI**:
   `http://localhost:3000/api/gmail/callback`
5. Copy the **Client ID** and **Client secret** into `.env.local`.

> Scopes used: `gmail.readonly` (read payment emails), `gmail.send` (send the
> confirmation email), `userinfo.email`. If you ever change scopes, **disconnect and
> reconnect** the Gmail account so the new permission is granted.

### 5. Start the app
```bash
npm run dev
```
Open **http://localhost:3000**.

### 6. First-run checklist
1. Go to **Gmail** → connect your Gmail account (approve the consent screen).
2. Go to **Bills** → *Upload a Bill* → pick an invoice PDF → AI extracts it → save.
3. Go to **Payments** → *Sync from Gmail* (payments also auto-sync every 5 min while
   the app is open). AI auto-matches them to bills.
4. Go to **To Review** → *Approve & mark paid* → vendor receives the payment email.

---

## How it works (architecture)

```
PDF upload ─┐
            ├─> lib/extract.ts ──> Groq/Gemini ──> structured invoice ─> invoices
Gmail sync ─┘                                       structured payment ─> payments
                                                            │
                              lib/match.ts (score 0–100) ───┤
                                                            ▼
                          To Review ──approve──> /api/approve ──> lib/email.ts
                                                                  (Gmail send)
```

- **`lib/db.ts`** — single `postgres` client (`ssl: 'require'`, `prepare: false` for
  the pooler).
- **`lib/extract.ts`** — `extractInvoice()` and `extractPaymentFromText()`; Groq first,
  Gemini fallback; friendly message on rate-limit.
- **`lib/match.ts`** + **`lib/run-match.ts`** — deterministic scoring (amount + vendor
  name similarity + date proximity; threshold 70) and the batch matcher.
- **`lib/google.ts`** — OAuth client, scopes, redirect URI.
- **`lib/email.ts`** — `paymentEmailHtml()` (corporate, email-client-safe HTML) +
  `sendGmailEmail()` via the Gmail API.
- **`components/auto-sync.tsx`** — silently POSTs `/api/gmail/sync` every 5 min while
  the app is open. (For 24×7 sync in production, add a real cron job hitting that route.)

### API routes
`/api/extract` · `/api/invoices` · `/api/payments` · `/api/vendors` ·
`/api/match` · `/api/stats` · `/api/approve` ·
`/api/gmail/{connect,callback,accounts,sync}`

---

## Project structure
```
app/(app)/*        Authenticated pages (sidebar shell): dashboard, review,
                   invoices, payments, vendors, connectors, settings
app/api/*          Route handlers (see above)
components/ui/     Button, Card, Badge, Drawer, RowMenu, Avatar, …
components/layout/ Sidebar, PageHeader
lib/               db, extract, match, run-match, google, email, utils
scripts/schema.sql Full database schema (run once)
docs/              ARCHITECTURE.md, ROADMAP.md
```

---

## Notes & gotchas

- **Use the Supabase pooler host** (`...pooler.supabase.com:6543`), not the direct
  DB host — the direct host is IPv6-only and fails to resolve on many networks.
- **AI rate limits:** the free Groq tier has a daily quota. Each email is sent to the
  AI only **once** (tracked in `scanned_emails`); on a 429 the sync stops gracefully
  and resumes next cycle.
- **Secrets:** every `.env*` file is gitignored — keys are never committed. If a key
  was ever shared or pasted somewhere public, rotate it.
- **`pdf-parse` is pinned to v1.1.1** (v2 has a different API).

## Scripts
```bash
npm run dev     # start dev server (Turbopack)
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

## License
Private / unpublished. All rights reserved.
