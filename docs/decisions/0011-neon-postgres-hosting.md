# Decision Record 0011: Neon Postgres Hosting For Beta

## Status

Accepted

## Date

2026-10-14

## Context

Decision records `0005` and `0010` both left "the exact production Postgres
provider" open. The early architecture notes leaned towards Supabase for auth,
storage, and Postgres, but auth has since moved to Google sign-in through
NextAuth (`0006`) and nothing in `apps/web` uses Supabase services.

The first beta deploy (`P-079`) needs a hosted Postgres for Production and for
Preview deployments, on the Vercel Hobby plan, at little or no cost.

## Decision

1. Use **Neon** Postgres on the **Free** plan for the first beta.
2. Use **two separate Neon projects**: one for Production, one shared by all
   Preview deployments. Each project gets its own free allowance (100
   CU-hours/month and 1 GB storage at the time of writing), and the two
   environments share nothing.
3. The Preview database is **persistent and shared** across preview
   deployments. It is seeded once with the deterministic fixture user
   (`npm run db:seed`) plus an admin login (`npm run db:create-admin`). Previews
   are tested through the admin login and user impersonation, because Google
   OAuth only accepts pre-registered redirect URIs and preview URLs are not
   stable.
4. Hosted databases are changed only with committed migrations
   (`npm run db:migrate`), never `db:push`.
5. The app keeps using the `pg` driver with Drizzle's `node-postgres` adapter.
   The app's `DATABASE_URL` uses Neon's pooled connection string; migrations
   and scripts use the direct (non-pooled) string.

## Consequences

- No new code dependency; switching provider later only means a new
  `DATABASE_URL` and a data migration.
- Neon's free plan suspends compute after 5 idle minutes, so the first request
  after idle time is slightly slower. Acceptable for beta.
- Free-plan point-in-time restore covers only 6 hours. Before the beta holds
  data that matters, move Production to a paid plan (7-day restore) or add a
  separate backup.
- Storage is the limit to watch: `interval_readings` grows quickly during
  historical backfill (`P-086`, `0009`). Exceeding 1 GB blocks writes on the
  free plan rather than deleting data.
- A migration from an open PR, once applied to the shared Preview database,
  affects every preview. Apply it only when that PR is ready to test.
- Preview MyEnergi access for the fixture user comes from preview-only
  `MYENERGI_USERNAME` / `MYENERGI_PASSWORD` variables. Production never sets
  them.

## Relationship To Earlier Decisions

- Closes the open provider question in `0005` and `0010`.
- Supersedes the Supabase-based storage/auth assumptions in
  `docs/architecture.md`; auth is already governed by `0006`.
