# PV Manager

PV Manager is a solar-energy and tariff-analysis web app focused on one core
question:

> Does owning solar materially reduce a household's electricity cost, and by
> enough to justify the install or financing cost over time?

The active product is the rewrite in [`apps/web`](apps/web).
It is the codebase validated by GitHub Actions for the `v2` branch and the one
all new product work should target.

The original application is preserved under [`V1/`](V1)
for reference while the rewrite continues.

## What The Product Does

PV Manager combines provider telemetry, tariff history, and financial
calculation logic to help a household understand:

- what their home is generating, importing, exporting, and self-consuming
- how solar changes their bill over time
- how tariff changes affect those outcomes
- whether the system appears to be paying for itself
- where data is missing, stale, or needs trust signals

The rewrite is intentionally built around trustworthy interpretation rather than
just showing raw power numbers.

## Main Product Surfaces

- `Live`: current-day generation, import/export, and solar context
- `Historical Day`: detailed day view for a specific date
- `Range History`: period-based analysis across weeks, months, years, and
  custom ranges
- `Settings`: tariff management, provider setup, location, investment history,
  and related user configuration
- `Admin / Approval flows`: support for invited beta users and operator control

Some adjacent features are already scoped in the backlog but still in progress,
including:

- richer Range History financial interpretation
- estimated backfill for missing range-history days
- a calendar-style year view
- broader beta operations and admin tooling

## Product Characteristics

- Multi-user web app from the rewrite forward
- MyEnergi is the current provider integration
- Tariff-aware historical calculations
- Daily-summary and interval-based reporting pipeline
- Weather and solar context support on Live
- Explicit backlog, feature, story, and decision records in-repo

## Technical Overview

The current rewrite stack in `apps/web` is:

- `Next.js 15` with the App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `NextAuth` for authentication
- `Drizzle ORM` with `Postgres`
- `Vitest` for tests
- `ECharts` for historical and financial charting

Supporting integrations include:

- `MyEnergi` for live and historical energy data
- `Open-Meteo` for current weather / forecast context
- `Resend` for email flows

## Rewrite Architecture At A Glance

At a high level, the rewrite is split into:

- `app/`: routes, pages, route handlers, and server-side entrypoints
- `src/domain/`: business and financial calculation rules
- `src/providers/`: provider adapters and credential handling
- `src/jobs/`: scheduled ingestion and summary generation logic
- `src/db/`: schema, queries, and seed data
- `src/range/`, `src/live/`, `src/settings/`, `src/weather/`: feature-focused
  modules

The important architectural idea is separation between:

- provider-specific ingestion
- canonical energy data and summaries
- tariff and billing logic
- product presentation

That separation is what lets the product evolve financially without the UI being
tightly coupled to raw provider payloads.

## Repository Layout

```text
.
├── apps/
│   └── web/         # Active rewrite app
├── docs/            # Product brief, architecture, features, stories, decisions
├── V1/              # Legacy application kept for reference
└── output/          # Generated artifacts and local outputs
```

## Local Development

The rewrite app lives under `apps/web`.

```bash
cd apps/web
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm run test
npm run lint
npm run db:generate
npm run db:push
npm run db:seed
npm run db:studio
npm run job:daily-summary
npm run job:catch-up
```

The current example environment file is:

- [`apps/web/.env.example`](apps/web/.env.example)

At minimum, local database access is expected. Additional auth, email, provider,
and runtime secrets may be required depending on which flows you want to run.

## Data Flow Summary

The rewrite is moving toward a model where:

1. provider data is fetched server-side
2. raw readings are normalized into a canonical internal shape
3. day-level summaries and derived reporting views are persisted
4. tariff-aware calculations are applied for historical analysis
5. UI surfaces read from those shaped results rather than re-deriving
   everything in the browser

This matters because much of the product value is in accurate historical and
financial interpretation, not just in displaying telemetry.

## Implementation Approach

PV Manager is built with a doc-first delivery flow so product intent,
calculation rules, and implementation scope stay aligned.

The typical path from idea to shipped feature is:

1. A product need or user problem is captured in the brief, backlog, or a
   discussion.
2. If the work changes product behavior or architecture meaningfully, it is
   captured as a feature in `docs/features/`.
3. If a decision has non-obvious technical or product consequences, it is
   recorded in `docs/decisions/`.
4. The feature is broken into smaller delivery slices in `docs/stories/todo/`.
5. Each story is implemented as a focused piece of work in the rewrite app,
   usually on its own branch.
6. Verification happens through a mix of tests, local validation, and product
   review against the documented acceptance criteria.
7. Completed work is reflected back into the backlog and supporting docs so the
   repo remains the source of truth.

In practice, the repo is intended to answer these questions clearly:

- `What are we building?` -> `docs/product-brief.md`, `docs/use-cases.md`
- `Why does it matter?` -> feature docs and decision records
- `What exactly is in scope right now?` -> `docs/backlog.md` and the active
  story docs
- `How should it work?` -> architecture and calculation docs
- `What was actually delivered?` -> code, tests, completed stories, and commit
  history

This approach is especially important here because the product is not just a UI
project. Small wording, tariff, or data-model changes can alter the financial
meaning of the app, so implementation is expected to stay tied closely to
written product intent.

## Documentation Map

Key docs:

- Product brief: [`docs/product-brief.md`](docs/product-brief.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Calculation spec: [`docs/calculation-spec.md`](docs/calculation-spec.md)
- Use cases: [`docs/use-cases.md`](docs/use-cases.md)
- Delivery backlog: [`docs/backlog.md`](docs/backlog.md)

Planning and execution docs:

- `docs/features/` for feature-level scopes
- `docs/stories/` for implementation slices
- `docs/decisions/` for important architectural and product decisions

## Current Status

The rewrite already includes meaningful end-to-end product slices, including:

- signed-in product shell
- MyEnergi provider connection flow
- Live screen
- Historical Day
- Range History
- tariff and settings management foundations

The next major focus areas are improving Range History interpretation and
performance, introducing estimate-aware handling for missing historical days,
and continuing the move from raw interval-heavy request paths to better derived
reporting layers.
