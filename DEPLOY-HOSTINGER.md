# Deploy PayRecord to Hostinger (native Next.js)

Hostinger's **Deploy Node.js Web App** feature natively supports **Next.js** and
builds straight from GitHub — it runs `npm run build` + `npm start` for you and
**auto-deploys on every push**. No Passenger, standalone, or GitHub Actions needed.

## Step 1 — Push the latest code to GitHub
Hostinger deploys whatever is on the `main` branch, so make sure it's current:
```bash
git add -A && git commit -m "…" && git push
```

## Step 2 — Connect the repo in hPanel
1. hPanel → **Deploy Node.js Web App** → **Import Git repository → Connect with GitHub**.
2. Authorize Hostinger and grant access to the **`dilranjandev-sudo/Invoice-gen`** repo.
3. Select repository **Invoice-gen**, branch **`main`**.
4. It auto-detects Next.js. Confirm (or set):
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Node version:** 20

## Step 3 — Add environment variables
In the app's settings, add the same keys as `.env.local`:
```
DATABASE_URL         = postgresql://…pooler.supabase.com:6543/postgres
GROQ_API_KEY         = gsk_…
GEMINI_API_KEY       = …            (optional)
GOOGLE_CLIENT_ID     = …
GOOGLE_CLIENT_SECRET = …
GOOGLE_REDIRECT_URI  = https://YOURDOMAIN/api/gmail/callback
APP_URL              = https://YOURDOMAIN
COMPANY_NAME         = Biqadx Private Limited
NODE_ENV             = production
```
> You'll know `YOURDOMAIN` after the first deploy — set `APP_URL` /
> `GOOGLE_REDIRECT_URI` to that URL, then redeploy.

## Step 4 — Deploy
Click **Deploy**. Hostinger builds and hosts it. After this, **every `git push` to
`main` auto-deploys** — nothing else to do.

## Step 5 — Point Google OAuth at the live domain
Google Cloud Console → Credentials → your OAuth client:
- **Authorized redirect URIs:** add `https://YOURDOMAIN/api/gmail/callback`
- **Authorized JavaScript origins:** add `https://YOURDOMAIN`

Then reconnect Gmail from the live site (Gmail page → Add account).

## Step 6 (optional) — 24×7 auto-sync via cron
The in-app sync only runs while a browser tab is open. For always-on syncing,
hPanel → **Advanced → Cron Jobs** → every 10 min:
```
*/10 * * * *   curl -s -X POST https://YOURDOMAIN/api/gmail/sync-all >/dev/null 2>&1
```

---

## Notes
- This uses **1 of your 5 Node.js app slots** on Business hosting.
- Keep the Supabase **pooler** host (`…pooler…:6543`) in `DATABASE_URL`.
- Secrets live only in Hostinger's env settings — never in the repo (`.env*` is
  gitignored).

## Troubleshooting
- **Build fails:** check the deploy logs — usually a missing env var. Node must be 20.
- **App starts but errors:** confirm `DATABASE_URL` and the AI keys are set.
- **OAuth `redirect_uri_mismatch`:** the `GOOGLE_REDIRECT_URI` env and the Google
  Console URI must exactly match your live domain.
