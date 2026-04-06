# Decision Record 0005: V1 Hosting On Vercel

## Status

Accepted

## Date

2026-04-04

## Context

Decision record `0001` intentionally deferred the final hosting choice while the
rewrite's application boundaries were still being established.

Those boundaries are now stable enough that the next backend feature needs a
real deployment shape, especially for:

- direct MyEnergi-backed server APIs
- a scheduled daily-summary job
- cheap beta hosting with low idle cost
- one coherent operational surface for routes, cron, and logs

The current planning direction is to choose the lower-cost Vercel path rather
than introducing a separate Lambda deployment for the rewrite backend.

## Decision

For v1, the rewrite will target a unified Next.js deployment on Vercel.

### Decided now

1. Backend APIs for the rewrite live in `apps/web`.
   - Route handlers or equivalent server-side modules inside the Next.js app are
     the default backend surface for v1.
   - The browser still talks only to our backend, never to MyEnergi directly.

2. Scheduled backend work uses Vercel Cron plus an internal authenticated
   server-side entrypoint.
   - Cron triggers must call a protected internal route or handler.
   - The handler must validate a shared secret or equivalent trusted signal
     before doing work.

3. The first beta may assume Ireland-only installations.
   - For now, installations can be assumed to use `Europe/Dublin`.
   - A single Vercel cron shortly after local midnight GMT/BST is acceptable for
     v1 beta operations.
   - The application logic must still resolve dates in `Europe/Dublin` and
     handle DST start/end correctly; cron simplicity does not remove the need
     for DST-safe local-day logic in adapters and summary jobs.

4. Postgres remains the relational source of truth for v1 persisted data.
   - `daily_summaries`, tariff data, installations, provider connections, and
     job metadata remain relational concerns.

5. Provider credentials are per-user connection data, not deployment-wide app
   config.
   - The rewrite must read MyEnergi credentials from the stored provider
     connection / credential reference for the relevant installation.
   - The legacy V1 pattern of deployment-level environment credentials is not
     the target model for the rewrite.

6. The implementation should stay Vercel-friendly, not Vercel-coupled.
   - Core provider, summary, and billing logic should remain plain app/server
     code rather than depending on Edge-only or provider-specific runtime APIs.
   - If deployment needs to move later, most logic should move with minimal
     rewrite.

## Consequences

### Immediate consequences

- The next backend stories should target app-owned route handlers and internal
  job entrypoints in `apps/web`.
- The direct MyEnergi adapter, daily-summary job, and range-summary API can be
  planned as one coherent backend feature.
- The temporary V1 bridge is now clearly transitional rather than a likely
  permanent runtime dependency.
- The onboarding path must persist one provider connection per installation so
  backend reads and jobs can resolve credentials from the database-linked
  connection context.

### Operational consequences

- Logs and scheduled execution should stay visible from one platform surface
  plus persisted job-run metadata in the database.
- Cron authentication secrets must be handled through server-side environment or
  secret-management facilities appropriate to Vercel.
- MyEnergi credentials should be stored per user/provider connection via a
  server-side-only credential reference rather than as one shared deployment
  secret.
- Local development must still support running the same route/job logic without
  requiring a cloud deploy.

### What this does not decide

- The exact production Postgres provider
- Final alerting/observability tooling beyond basic logs and persisted run state
- Whether a separate worker service is ever introduced for later high-volume
  backfill or analytics work

## Relationship To Earlier Decisions

- This decision narrows the infrastructure deferral left open in
  [`0001-runtime-boundaries-and-infra-deferral.md`](/Users/john/Documents/Projects/pv-manager/docs/decisions/0001-runtime-boundaries-and-infra-deferral.md).
- It does not change the summary-first v1 data-flow decision from `0001`; it
  only finalizes the first deployment surface used to implement that model.
