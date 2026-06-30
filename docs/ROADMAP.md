# PayRecord — Features & Automation Roadmap

## ✅ Working today
- Gmail OAuth (multiple accounts) + background auto-sync (every 5 min while app is open)
- AI extraction — bills (PDF upload, Groq) + payments (from Gmail, Groq) with confidence score
- AI matching (invoice ↔ payment, 0–100 score) — runs automatically after each sync
- Review & **one-click Approve** → marks the bill paid
- Vendors (auto-saved on approve), Bills, Payments — full **edit / delete**, Supabase persistence
- Analytics dashboard on real data (KPIs, bar chart, donut, sparklines)

---

## 🧩 Features that can be added

### Core AP
1. **Auto-ingest bills from Gmail attachments** — vendor emails a PDF → auto-extracted (no manual upload)
2. **Voucher / receipt PDF** generation (company logo, GSTIN, professional layout)
3. **Gmail auto-reply** with the voucher PDF on the original thread (closes the loop)
4. **Due-date tracking + reminders** for unpaid bills
5. **Duplicate detection** — flag the same bill/payment twice
6. **Reports & export** — monthly spend, vendor-wise, **GST/tax (input-credit) summary** → CSV / Excel / PDF
7. **Global search** — vendor / invoice # / UTR / amount / date
8. **Bulk actions** — select many → approve / delete / export at once
9. **Attachments** — keep the original PDF in Supabase Storage + in-app preview
10. **Activity log / audit trail** — who did what, when

### Automation & intelligence
11. **Auto-approve rules** — confidence + exact-amount + known-vendor thresholds
12. **Server cron 24×7 sync** — runs even when the app is closed (production)
13. **Smart categorization** — auto-tag each bill (Software, Cloud, Travel…)
14. **AI chat assistant** — "show payments to FutureCore this month"

### Integrations
15. **Tally / QuickBooks / Zoho Books** export or sync
16. **Bank statement (CSV) import** — beyond Gmail
17. **WhatsApp bill import**

### Platform
18. **Roles & permissions** — Admin / Finance / Reviewer / Viewer
19. **Company settings** — name, GSTIN, PAN, address, logo (used on vouchers)
20. **Notifications** — email / WhatsApp / push digest of what needs you
21. **Mobile-responsive** + **magic-link approve** straight from an email
22. **Multi-company / multi-currency**

---

## ⚡ Minimize clicks — automation plan

**Goal: 0 clicks for the normal case, 1 click for exceptions.**

```
Gmail (bill PDF + payment email)
        ↓  auto-extract (AI)
        ↓  auto-match (AI score)
   ┌────────────────────────────┐
   │ score ≥ threshold &        │ → AUTO-APPROVE → AUTO-REPLY voucher → done   (0 clicks)
   │ amount exact & vendor known│
   └────────────────────────────┘
   │ otherwise (ambiguous)      │ → "To Review" → 1-click Approve              (1 click)
   └────────────────────────────┘   (even from a magic-link in an email)
```

### Steps to get there
1. **Server cron** hits `/api/gmail/sync` every 5 min — continuous, app need not be open.
2. **Auto-extract bills from Gmail attachments** — not just manual upload.
3. **Auto-approve** when match ≥ 95% + exact amount + known vendor (threshold set in Settings).
4. **Auto-reply** the voucher PDF to the vendor's email thread after approval.
5. **Email / WhatsApp digest** with one-click approve links for the few exceptions.
6. **"Approve all"** button to clear the review queue in one click.

**Net effect:** the user mostly does nothing. The system ingests, extracts, matches, approves the safe ones, and replies. Only the few uncertain matches need a single tap — which can be done from a notification, without even opening the app.

---

## 🇮🇳 India / GST-specific (high value)
- **GSTIN auto-validate + auto-fill** — verify a vendor's GSTIN and pull their legal name/address automatically
- **GSTR-2B reconciliation** — match your bills with what vendors reported to the govt → claim the right **Input Tax Credit (ITC)**; flag missing/mismatched ones
- **TDS handling** — auto-compute TDS on vendor payments, track sections & certificates (26Q)
- **E-invoice (IRN + QR)** generation for B2B
- **HSN/SAC validation** and tax-rate checks
- **ITC dashboard** — how much input credit is claimable this month

## 💸 Payments & banking
- **Pay from the app** — initiate UPI/bank transfer (not just record) via a payment gateway/bank API
- **Payment scheduling** — auto-pay on due date; **bulk pay** many vendors at once
- **Bank-detail-change fraud alert** — warn if a known vendor's bank account suddenly changes (common scam)
- **Penny-drop bank verification** for new vendors

## 🧠 Smarter AI
- **Auto-learn from corrections** — when you fix an extracted field, the system remembers that vendor's format
- **Vendor-specific templates** — near-perfect extraction per vendor over time
- **Smart match suggestions** — for an unmatched payment, suggest the most likely bill
- **Anomaly detection** — unusual amount, brand-new vendor, price jump vs last bill
- **OCR fallback** for scanned/image-only bills (no embedded text)

## 🔁 Workflow & collaboration
- **Email-forward inbox** — forward any bill to `bills@yourco.payrecord.app` → auto-ingested
- **Multi-level approval** — amounts over ₹X need a manager's sign-off
- **Comments / notes / assign** a bill to a teammate; **@mentions**
- **Approve from Slack / Teams / WhatsApp**

## 📊 Finance depth
- **Aging report** (30 / 60 / 90 days overdue) + **cash-flow forecast** (upcoming dues)
- **Budgets per category/vendor** + over-budget alerts
- **Credit / debit notes & refunds**, partial payments / installments
- **Vendor statements** (full transaction history, sendable)
- **Early-payment discount** tracking & savings insights

## 🛡️ Platform & trust
- **Soft-delete + Trash/restore + Undo** (instead of permanent delete)
- **Encrypt refresh tokens** at rest (currently plain) + 2FA login + session/device list
- **Custom fields, tags, saved filters/views**
- **API + webhooks**, full data export/backup
- **Onboarding wizard** (connect Gmail → first sync → done) + **dark mode**
