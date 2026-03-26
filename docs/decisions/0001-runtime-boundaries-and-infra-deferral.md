# Decision Record 0001: Runtime Boundaries And Infrastructure Deferral

## Status

Accepted

## Date

2026-03-26

## Context

The rewrite has reached the point where a few architectural boundaries need to be
made explicit so product and schema decisions do not drift:

- how live data should be fetched
- what historical data should be persisted
- where provider-specific logic should live
- whether deployment and infrastructure choices must be finalized now

The current docs lean toward canonical interval ingestion and persisted
`energy_readings`, but the intended product shape for v1 is narrower:

- live and single-day detail should come directly from the provider
- multi-day views should come from persisted daily summaries
- supplier bill reconciliation is not a planned v1 product feature
- low idle cost matters, so the runtime should remain compatible with
  serverless-style deployment

## Decision

We are deciding the application boundaries now, while explicitly deferring the
final hosting and infrastructure platform choice.

### Decided now

1. The browser must never call provider APIs directly.
   - The frontend talks only to our backend.
   - Provider credentials, provider URLs, and provider-specific request details
     stay server-side.

2. Live and single-day detail are fetched on demand from the provider.
   - The homepage "today" view should load current day data from the provider.
   - A selected single day should also be fetched from the provider rather than
     from persisted interval rows.
   - Short-lived server-side caching is allowed as an optimization.

3. Multi-day history is powered by persisted daily summaries.
   - Historical week, month, year, and custom range queries should read from
     `daily_summaries`.
   - v1 does not require persisted half-hour or minute-level readings for these
     views.

4. Daily summarisation runs as a centrally triggered backend job.
   - A scheduled job fetches the completed previous day from the provider and
     writes or updates one daily summary row per installation and local date.
   - The summarisation flow must be idempotent and safe to retry.

5. Supplier bill reconciliation is out of scope for v1 product behavior.
   - Estimated costs and savings should be calculated from provider data plus
     tariff metadata.
   - The product should not attempt to adjust or correct its results against a
     supplier bill upload in v1.

6. The backend must remain provider-agnostic from the UI's point of view.
   - Provider adapters should normalize provider-specific behavior into app-owned
     response shapes and summary inputs.
   - Adding another provider later should not require UI contracts to change.

7. A relational persistence model remains the default direction.
   - Tariffs, tariff versions, installations, provider connections, job state,
     and daily summaries are naturally relational.
   - We are not adopting DynamoDB as the primary store at this time.

### Explicitly deferred

1. Final deployment platform choice
   - AWS-native split deployment
   - Next.js-oriented unified deployment
   - another equivalent serverless-compatible platform

2. Final infrastructure tooling choice
   - CloudFormation / CDK
   - platform-native configuration
   - another IaC approach

3. Whether v1 backend endpoints live:
   - inside a Next.js app as serverless route handlers, or
   - in a separately deployed backend such as Lambda

4. Whether interval persistence will be introduced later for:
   - billing fidelity
   - diagnostics
   - provider reconciliation
   - other future use cases

## Consequences

### Immediate consequences

- The v1 architecture should be simplified around:
  - provider-backed live/day detail
  - persisted `daily_summaries` for ranges
  - server-side tariff and cost estimation
- `energy_readings` is no longer assumed to be a required v1 runtime table.
- Stories built around seeding or reading interval data should be revised.

### Constraints on future deployment

Whatever platform we choose later must support:

- server-side secret handling for provider credentials
- request-driven backend execution suitable for low idle cost
- centrally triggered scheduled jobs
- local development without requiring a cloud deploy for normal backend changes
- a relational database with straightforward local development support
- idempotent scheduled writes and safe retries

### What this does not prevent

This decision does not rule out:

- using AWS for production deployment
- using Lambda for backend endpoints and scheduled work
- using Next.js for the web application
- adding interval persistence later if a concrete product need emerges

## Proposed v1 Request And Data Flow

```text
Browser
  -> app backend endpoint
  -> provider adapter
  -> provider API

Browser
  -> app backend endpoint
  -> relational database

Nightly scheduler
  -> summary job endpoint
  -> provider adapter
  -> provider API
  -> daily_summaries
```

## Follow-up Implications For The Backlog

The backlog should be updated to reflect this decision:

- revise `P-020` so seed data focuses on users, installations, tariffs, and
  `daily_summaries`
- revise `P-021` so the first vertical slice reads `daily_summaries` and tariff
  data rather than interval readings
- revisit `docs/architecture.md` so it no longer implies interval persistence is
  the default v1 path

