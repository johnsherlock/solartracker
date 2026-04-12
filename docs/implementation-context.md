# Implementation Context

This document is the lean default context for implementation work in the rewrite.
It summarizes the architecture and product rules that still matter across active
stories without requiring every agent to load the full architecture history.

Use this as the default shared context, then read the specific story, feature,
and only the decision records that are relevant to that work.

## Repo Boundaries

- The rewrite app lives in `apps/web`
- The legacy app remains in the repo root and must not be modified for rewrite
  stories
- New implementation work should prefer the rewrite app unless a story
  explicitly says otherwise

## Current Runtime Shape

The rewrite is a unified Next.js app with server-side routes/actions plus
Postgres-backed persistence.

High-level flow:

```text
Browser
  -> apps/web backend
  -> provider adapter
  -> provider API

Browser
  -> apps/web backend
  -> Postgres

Scheduled job
  -> apps/web internal job entrypoint
  -> provider adapter
  -> provider API
  -> Postgres
```

Key rule:

- the browser must never call provider APIs directly

## Current Hosting / Ops Assumptions

- v1 targets a unified Next.js deployment on Vercel
- scheduled work should use internal authenticated app-owned job entrypoints
- the implementation should stay Vercel-friendly, not deeply Vercel-coupled
- local development must still support the same core logic without a cloud-only
  dependency

## Data Flow Rules

These are stable and should not be re-litigated in normal story work:

1. Live and single historical day reads come directly from the provider through
   our backend
2. Multi-day history reads from persisted `daily_summaries`
3. Daily summary generation is a scheduled backend job and must be idempotent
4. Provider-specific logic belongs in provider adapters, not in product-facing
   UI contracts or core billing logic
5. Supplier bill reconciliation is not part of normal v1 product behavior

## Persistence Model

The rewrite is now centered on a summary-first relational model, not persisted
interval readings as a default runtime dependency.

The main runtime entities are:

- `users`
- `installations`
- `provider_connections`
- `tariff_plans`
- `tariff_plan_versions`
- `daily_summaries`
- `job_runs`

Important implications:

- `daily_summaries` power range and reporting views
- provider credentials are represented through a server-side-only
  `credential_ref` or equivalent indirection, not browser-visible values
- provider connection operational state belongs on `provider_connections`
- optional future tables or archival/debug data should not be treated as core
  product dependencies unless a story explicitly adds them

## Auth And Access Model

The current beta access model is:

- Google-only sign-in for real users
- no app-stored user passwords
- any user may sign in
- new non-admin users default to:
  - role `user`
  - status `awaiting_approval`
- admin users are seeded by exact Google email
- admin accounts are operator accounts, not normal customer installations

User status and access are separate from provider readiness:

- `awaiting_approval` user: can sign in, sees waitlist / invite-only response,
  can sign out
- `approved` user without valid provider credentials: blocked on provider setup
- `approved` user with valid provider credentials: enters the normal app
- `suspended` user: blocked from normal app access

Important identity rule:

- a different Google email is a different user
- Gmail `+suffix` variants are treated as distinct users if Google presents them
  as distinct verified emails

## Provider Setup Rules

The current beta has one hard product requirement for real users:

- valid provider credentials are required before normal app entry

Implementation rules:

- provider setup should be shaped as provider selection plus provider-specific
  credentials form
- for now only MyEnergi is supported
- supplied MyEnergi credentials must be validated server-side before the user is
  considered ready for app access
- invalid credentials should keep the user on the provider gate with a clear,
  recoverable error
- later setup such as tariff, finance, solar, or location details should live
  in Settings rather than bloating `FE-007`

## Demo Mode

Public demo mode exists outside the approval flow.

Rules:

- no sign-in required for demo mode
- demo mode uses seeded/sample data
- demo mode is read-only
- demo mode must not expose Settings, provider setup, or other write flows
- demo mode should show a persistent banner/indicator
- demo mode is not a normal beta user account

## Current UI / Product Shape

The app now has several distinct surface types:

- public / unauthenticated pages
- public read-only demo mode
- admin/operator area
- normal signed-in product area
- provider-setup gate for approved-but-not-ready users

When implementing, keep these roles separate rather than blending operator,
demo, and normal-user concerns into one shared surface.

## Current Frontend Defaults

These are the current practical defaults for frontend work in `apps/web`:

- Next.js App Router
- Tailwind CSS for styling
- `lucide-react` for icons
- `ECharts` / `echarts-for-react` for charting
- app-owned local components rather than a formal external UI kit

Guidance:

- Prefer the patterns and components already used in `apps/web`
- Do not reintroduce `Recharts` for new chart work
- Do not assume `shadcn/ui`, `React Hook Form`, or `Zod` are baseline
  dependencies without first adding and justifying them
- Avoid introducing a new UI or form library unless the story clearly benefits
  and the change is intentional

## Implementation Guardrails

- Keep provider-specific code out of domain-level product logic
- Prefer app-owned server routes/actions/services over client-side direct
  integration
- Keep changes scoped to the requested story
- Do not rebuild unrelated flows just because the surrounding docs mention them
- Preserve future provider extensibility where easy, but do not overbuild for
  unsupported providers now
- Avoid introducing auth or credential patterns that contradict the accepted
  decisions

## What Usually Needs Extra Reading

This doc is intentionally not enough for detailed implementation by itself.
Before planning or coding a story, also read:

- the specific story file
- the feature file
- any decision records directly relevant to that feature/story

As of now, the most likely relevant decision records for active work are:

- `0001-runtime-boundaries-and-infra-deferral.md`
- `0005-v1-hosting-on-vercel.md`
- `0006-beta-auth-approval-and-provider-gating.md`

Weather/location decisions should only be loaded for weather/location work.

## Deep Reference Docs

Use these only when the story actually needs them:

- `docs/architecture.md`
  - full architecture history, deeper schema rationale, older planned shapes
- `docs/calculation-spec.md`
  - billing/savings rules and financial terminology
- `docs/decisions/*.md`
  - point decisions that narrow specific product or architecture choices
- `docs/ui/*.md`
  - screen directions and UX details for specific surfaces

## Current Defaults For Active Story Work

For most current stories, the sensible reading order is:

1. `CLAUDE.md`
2. `docs/implementation-context.md`
3. the story file
4. the feature file
5. only the decision records that clearly apply
6. only the deeper architecture/UI docs needed for the exact task
