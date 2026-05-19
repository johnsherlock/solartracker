# Decision Record 0010: Vercel-Native Background Work

## Status

Accepted

## Date

2026-05-19

## Context

Decision record `0005` established that the rewrite will run as a unified
Next.js deployment on Vercel and that scheduled backend work should use a
Vercel cron-triggered internal route.

Since then, the delivery and operations planning has started to talk about a
broader set of background work beyond the nightly daily-summary job, including:

- new-user historical backfill
- tariff-edit-triggered rebuild work
- provider health checks
- other durable internal job flows needed for beta operations

That planning direction has been visible in backlog item `P-006` and in
`FE-012`, but it has not yet been captured as a formal architectural decision.
This leaves open an ambiguity about whether any of these background workflows
should be orchestrated through GitHub Actions or other external automation.

For beta, we want one clear answer:

- runtime background work should stay on the same operational surface as the
  deployed app
- GitHub should remain a source-control and CI surface, not a product runtime
  job runner

## Decision

Background product work for the rewrite will use Vercel-native execution
primitives, not GitHub.

### Decided now

1. Time-based runtime work uses Vercel Cron.
   - The nightly daily-summary kickoff remains a Vercel cron-triggered internal
     route or equivalent privileged server-side entrypoint.
   - Additional scheduled operational checks, such as provider health checks,
     should also use Vercel-native scheduling where appropriate.

2. Durable event-driven runtime work uses Vercel-native background execution.
   - Historical backfill, tariff-edit-triggered rebuilds, and similar
     must-complete background tasks should run through Vercel-native background
     primitives such as Vercel Workflow and any supporting queue/event
     mechanism that Vercel provides or integrates with as part of that path.
   - These jobs should be chunked, retry-safe, and idempotent.

3. GitHub Actions is not part of the product runtime job model.
   - GitHub Actions may still be used for CI, PR validation, linting, test
     runs, and similar repository automation.
   - GitHub Actions should not be used to run nightly ingestion, onboarding
     backfill, tariff rebuilds, provider health checks, or other user/data
     affecting runtime jobs for the beta product.

4. Operational visibility should stay as consolidated as practical.
   - Job execution, retries, and logs for runtime background work should be
     inspectable from the same operational environment as the deployed app as
     much as possible.
   - Persisted job metadata in the application database remains appropriate for
     product-facing or support-facing job status where needed.

5. The implementation should remain Vercel-friendly, not tightly coupled to
   one incidental API shape.
   - Core job logic should stay in app-owned server modules.
   - Vercel-native scheduling/execution should invoke that logic rather than
     hardwiring product behavior directly into thin platform glue.

## Consequences

### Product consequences

- The beta operational model is simpler to reason about: deployed app runtime
  work happens on Vercel, not split between Vercel and GitHub.
- Onboarding, rebuild, and health-check behavior can be explained as part of
  one app/platform lifecycle rather than as a separate repo automation layer.

### Operational consequences

- `FE-012` and `P-006` should describe Vercel-native background work
  explicitly, not as an open question.
- Deployment-path stories should assume Vercel preview/production deployment
  flows rather than GitHub-based runtime job orchestration.
- Any backlog wording that implies GitHub could be the runtime home for jobs
  should be updated or removed.

### What this does not decide

1. The exact production Postgres provider
2. The final alerting/reporting stack beyond Vercel plus app-owned metadata
3. The final user-facing UX for job status, backfill progress, or rebuild
   diagnostics
4. Whether every future background task uses the same Vercel primitive, as long
   as it stays within the Vercel-native runtime model

## Relationship To Other Decisions

- This extends `0005-v1-hosting-on-vercel.md` from "Vercel Cron for the nightly
  job" to the broader beta background-work model.
- It does not replace the app-boundary rules in
  `0001-runtime-boundaries-and-infra-deferral.md`; it clarifies where the
  runtime orchestration for those app-owned jobs lives.
