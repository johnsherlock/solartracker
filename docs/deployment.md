# Deployment And Beta Runbook

How `apps/web` is deployed for the first beta, which environment needs which
settings, and what to check when something breaks.

Fixed choices this builds on:

- **Hosting:** Vercel, Hobby plan (`0005`, `0010`)
- **Database:** Neon Postgres, free plan, separate Production and Preview
  projects (`0011`)
- **Domain / DNS:** `solartracker.app` on Cloudflare; canonical host
  `www.solartracker.app` ([beta-domain-and-email-stack.md](beta-domain-and-email-stack.md))
- **Email:** Resend sending as `noreply@solartracker.app`; human support at
  `support@solartracker.app` (Zoho)
- **Shipping branch:** `main` → Production. Every other branch / PR → Preview.

## Environments At A Glance

| | Local | Preview | Production |
|---|---|---|---|
| URL | `http://localhost:3000` | random `*.vercel.app` per deploy | `https://www.solartracker.app` |
| Database | Docker Postgres | Neon **preview** project (shared, persistent) | Neon **production** project |
| Data | `db:seed` fixture | `db:seed` fixture + admin login | real users only — **never seed** |
| Google sign-in | yes (localhost redirect) | **no** — preview URLs aren't registered with Google | yes |
| How to test as a user | sign in, or admin impersonation | admin login → impersonate the fixture user | real Google account |
| Nightly cron | no | **no** — Vercel Cron only calls Production | yes, 01:00–01:59 UTC |
| Emails | only if `RESEND_API_KEY` set | leave unset (approval still succeeds; email logs an error) | yes |

## Environment Variables

Set in Vercel → Project → Settings → Environment Variables, scoped per
environment. `apps/web/.env.example` has the same list with comments.

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `DATABASE_URL` | Neon production, **pooled** connection string | Neon preview, pooled | |
| `NEXTAUTH_SECRET` | random, unique | random, different from prod | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://www.solartracker.app` | *unset* | NextAuth falls back to the deployment URL on Vercel |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | production OAuth client | *unset* | Google sign-in isn't used on previews |
| `ADMIN_SESSION_SECRET` | random, unique | random | optional; falls back to `NEXTAUTH_SECRET` |
| `CRON_SECRET` | random, ≥16 chars | *unset* | `openssl rand -hex 32`; Vercel sends it as `Authorization: Bearer …` |
| `CREDENTIAL_ENCRYPTION_KEY` | 64 hex chars, unique | 64 hex chars, different | `openssl rand -hex 32`. **Never change in Production** without re-encrypting stored credentials — every user would have to reconnect MyEnergi |
| `RESEND_API_KEY` | Resend API key (sending access) | *unset* | |
| `FROM_EMAIL` | *unset* (defaults to `noreply@solartracker.app`) | *unset* | |
| `GEOAPIFY_API_KEY` | key | same key is fine | Settings → Location address lookup |
| `MYENERGI_USERNAME` / `MYENERGI_PASSWORD` | **never set** | your hub serial / API key | only used by the seeded fixture user's `env:` credential ref |

Not set in Vercel: `ADMIN_USERNAME` / `ADMIN_PASSWORD` — these are read only
by the `db:seed` and `db:create-admin` scripts run from a laptop.

Store every generated secret in your password manager as you create it.

## First-Time Setup

Do these in order. Steps 1–4 need no code changes.

### 1. Neon

1. Create two Neon projects (free plan), e.g. `solartracker-production` and
   `solartracker-preview`. Either use Vercel's Neon integration
   (Vercel → Storage / Marketplace) or sign up directly at neon.com and paste
   the connection strings into Vercel yourself.
2. Pick a region close to the Vercel functions region (Vercel → Project →
   Settings → Functions) — European for an Ireland-only beta.
3. Copy each project's **pooled** connection string (the host contains
   `-pooler`).

### 2. Vercel project

1. Sign up at vercel.com with **Continue with GitHub** (account `johnsherlock`),
   Hobby plan.
2. **Add New → Project →** import `johnsherlock/solartracker`.
3. **Root Directory:** `apps/web`. Framework preset: Next.js (auto-detected).
   Production branch: `main`.
4. Add the environment variables from the table above before the first
   deploy, or redeploy after adding them.

### 3. Database schema and admin login

Run from `apps/web` on your laptop. Values passed on the command line take
precedence over `.env` / `.env.local`, and each script prints the target host
before writing — check it.

```bash
# Avoid leaving the password in shell history
read -s "ADMIN_PASSWORD?Admin password: "; export ADMIN_PASSWORD

# Production: schema + admin only. Never run db:seed here.
DATABASE_URL='<neon production pooled url>' npm run db:migrate
DATABASE_URL='<neon production pooled url>' ADMIN_USERNAME=<username> npm run db:create-admin

# Preview: schema + fixture user + admin
DATABASE_URL='<neon preview pooled url>' npm run db:migrate
DATABASE_URL='<neon preview pooled url>' npm run db:seed
DATABASE_URL='<neon preview pooled url>' ADMIN_USERNAME=<username> npm run db:create-admin

unset ADMIN_PASSWORD
```

`db:create-admin` is safe to re-run: an existing username just gets the new
password.

### 4. Google OAuth (Production only)

In Google Cloud Console → APIs & Services:

1. **Credentials →** the OAuth 2.0 client used for production (create a new
   *Web application* client if the existing one is only set up for localhost):
   - Authorized JavaScript origin: `https://www.solartracker.app`
   - Authorized redirect URI:
     `https://www.solartracker.app/api/auth/callback/google`
2. **OAuth consent screen:** publishing status must be **In production**. In
   *Testing* mode only listed test users can sign in, and everyone else sees
   "Access blocked". Basic `email` / `profile` scopes don't need Google
   verification.
3. Put the client ID and secret into Vercel's Production environment.

### 5. Domain

1. Vercel → Project → Settings → Domains: add `www.solartracker.app`, then
   `solartracker.app`, and set the apex to **redirect to `www`**.
2. In Cloudflare → DNS for `solartracker.app`, add exactly the records Vercel
   shows: an `A` record for the apex and a `CNAME` for `www`. The `www` value
   is specific to the project, so copy it from Vercel rather than from older
   docs.
3. Set both records to **DNS only** (grey cloud), so Vercel can issue the TLS
   certificate and Cloudflare isn't proxying in front of Vercel.
4. **Do not touch** the existing Zoho `MX`, SPF/DKIM `TXT`, the Resend
   `resend._domainkey` / `send` records, or `_dmarc`. Don't add a second SPF
   record.
5. Wait for Vercel to show both domains as *Valid Configuration*.

### 6. Resend

The domain is already verified (`P-085`). Create an API key with **sending
access** only and set it as `RESEND_API_KEY` in Production.

### 7. First production deploy

Merge to `main` (or redeploy from the Vercel dashboard), then run the smoke
checks below.

## Deploying Changes

1. Open a PR → Vercel builds a **Preview**. GitHub CI runs tests + build.
2. **If the PR adds a migration** (`apps/web/drizzle/*.sql`), apply it to the
   preview database only when you're ready to test that PR — the preview
   database is shared:
   `DATABASE_URL='<preview url>' npm run db:migrate`
3. Test the preview: sign in at `/solaris` with the admin login and
   impersonate the fixture user from `/admin/users`.
4. **Before merging a PR with a migration**, apply it to Production:
   `DATABASE_URL='<production url>' npm run db:migrate`. Migrations must stay
   backwards-compatible with the code currently live, because the schema
   changes before the new code is deployed.
5. Merge to `main` → Vercel deploys Production → run the smoke checks.

Always use `db:migrate` against hosted databases, never `db:push`. `push`
diffs the live schema and would churn four foreign keys whose generated names
exceed Postgres's 63-character limit.

To create a migration after changing `src/db/schema.ts`: `npm run db:generate`,
review the SQL, and commit it with the change.

## Smoke Checks

After every Production deploy:

- [ ] `https://solartracker.app` redirects to `https://www.solartracker.app`
- [ ] Landing page loads; "Request invite" adds a row visible at `/admin/waitlist`
- [ ] `/sign-in` → Google sign-in completes and lands on the expected page for
      the account (`/waiting`, `/connect-provider`, or `/live`)
- [ ] Admin login at `/solaris` works; `/admin/users` lists users
- [ ] An approved user with a provider connection sees today's data on `/live`
- [ ] `/range` and `/calendar` load history
- [ ] Vercel → Project → Settings → Cron Jobs lists
      `/api/internal/jobs/daily-summary` at `0 1 * * *`

After the first deploy, and after any change to email or approval code:

- [ ] Approve a test account → the approval email arrives from
      `noreply@solartracker.app` and links to `/sign-in`

The morning after the first deploy:

- [ ] Cron Jobs → **View Logs** shows a `200` response for the overnight run

## First Response

### Sign-in fails

| Symptom | Check |
|---|---|
| Google shows `redirect_uri_mismatch` | The redirect URI in Google Cloud exactly matches `https://www.solartracker.app/api/auth/callback/google`, and `NEXTAUTH_URL` is the `www` host |
| Google shows "Access blocked" / app not verified | OAuth consent screen is still in *Testing* — publish it |
| Loops back to `/sign-in`, or "server configuration" error | `NEXTAUTH_SECRET` is set for Production; Vercel runtime logs for `[next-auth]` errors |
| Approved user still sees `/waiting` | They should reload `/waiting` (it refreshes their status); otherwise sign out and back in. Confirm `status = approved` in `/admin/users` |

### Nightly summary job didn't run or failed

1. Vercel → Settings → Cron Jobs → **View Logs**:
   - `401` → the secret Vercel sent doesn't match the running deployment's,
     usually because `CRON_SECRET` was changed without redeploying.
     Environment variable changes only apply to new deployments.
   - `500` "Server misconfiguration" → `CRON_SECRET` not set in Production
   - `500` with job details → provider or database error; read the log lines
     tagged `[daily-summary-job]`
   - No invocation at all → Vercel cron delivery is best effort; occasional
     misses happen
2. Re-run yesterday from the dashboard (**Run** on the cron job), or:
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.solartracker.app/api/internal/jobs/daily-summary`
3. Several days missing → backfill from a laptop:
   `DATABASE_URL='<production url>' npm run job:catch-up -- --from YYYY-MM-DD`
   (add `--user email@example.com` to limit it to one user). Production
   credentials are encrypted, so this also needs Production's
   `CREDENTIAL_ENCRYPTION_KEY` passed the same way.
4. Runs stuck without a `finished_at` in `job_runs`:
   `DATABASE_URL='<production url>' npx tsx src/scripts/fix-stuck-jobs.ts`.
   Read the script first.

### Provider (MyEnergi) errors for one user

Check `provider_connections` for that installation: `last_error_code`,
`last_error_summary`, `last_failed_sync_at`. Credential errors mean the user
needs to re-enter their MyEnergi details under Settings → Provider.

### Emails not arriving

1. Vercel runtime logs: `[approveUser] approval email failed`
2. Resend dashboard → Logs: was the send accepted, bounced, or rejected?
3. `RESEND_API_KEY` is set in Production and has sending access
4. Domain still verified in Resend, and the Cloudflare DNS records are intact

### Database

- Neon console → the project → **Monitoring** for connection errors and storage
- Free plan: storage over 1 GB blocks writes (it doesn't delete data). Check
  `interval_readings` size first.
- Restore: the free plan can only restore to a point within the last 6 hours —
  act quickly after a bad migration or data change.

### Roll back a bad deploy

Vercel → Deployments → previous good Production deployment → **Instant
Rollback**. This reverts code and cron config only, not database migrations.
