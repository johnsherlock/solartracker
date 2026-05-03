# Decision Record 0009: interval_readings Retention Strategy

## Status

Open — decision required before implementing P-060

## Date

2026-05-03

## Context

When `daily_summaries` were replaced by half-hour `interval_readings` (P-056),
`interval_readings` became the source of truth for Range History. Every page
load priced each 30-minute slot at the tariff applicable to its time of day.

P-059 introduced `daily_priced_rollups` — pre-computed day-level outputs derived
from `interval_readings` using that same per-slot pricing logic. After P-059:

- Range History reads exclusively from `daily_priced_rollups`
- The `/api/range` endpoint reads exclusively from `daily_priced_rollups`
- The `page.tsx` SSR path reads exclusively from `daily_priced_rollups`
- The "earliest available date" query targets `daily_priced_rollups`

`interval_readings` now has **zero user-facing reads**. The only code that still
reads from it is the rollup build pipeline itself (`buildAndPersistRollupForDate`
and `runRollupCatchUp`), which is an operator-triggered or background process,
not a user request path.

Decision 0008 explicitly assumed raw intervals would remain the source of truth
so that historically priced outputs could be rebuilt after tariff edits. That
assumption pre-dates the delivery of P-059 and the tariff-edit rebuild story
(P-060) remaining unimplemented.

A retention question has now opened:

- Storing years of half-hourly readings for every installation has a real and
  growing storage cost.
- That data is being held speculatively for a capability (tariff-edit rollup
  rebuild) that is not yet implemented.
- MyEnergi's API appears to retain full historical data. If that holds, raw
  intervals could be re-fetched from the provider on demand rather than stored
  locally indefinitely.

## Options

### Option A — Keep interval_readings indefinitely (current default)

P-060 rebuilds rollups by re-reading stored local intervals. Simple to implement
because the data is already local. Storage grows linearly with installations and
history depth.

### Option B — Treat interval_readings as a short-term buffer; re-fetch for rebuilds

Retain intervals for a rolling window (e.g. 90 days) sufficient to cover normal
ingestion and recent-period corrections. For a tariff-edit rebuild that touches
older history, re-fetch the affected date range from the MyEnergi API and build
rollups in that pass.

Provide a stale flag as fallback: if the API re-fetch fails (rate-limited,
provider outage, etc.), mark affected rollup rows as `stale = true` and surface
a visible warning in the UI rather than silently serving stale priced data.
This is a rare admin action, so a degraded-mode warning is an acceptable user
experience.

### Option C — Delete interval_readings immediately after rollup is built

Minimal storage. No retained buffer at all. Rebuilds are always via API. Highest
dependency on provider availability.

## Recommendation (not yet decided)

The discussion prior to this record leaned toward **Option B**:

- The storage cost of holding years of intervals for every installation is real.
- MyEnergi retaining full history means the data is not truly lost if we drop
  local copies.
- A stale flag fallback is a reasonable user experience for a rare operator
  action (tariff history correction).
- Option C goes too far — a rolling buffer provides a safety net for ingestion
  edge cases and reduces API round-trips for recent-period rebuilds.

However this has not been formally decided. The choice materially affects P-060's
implementation (whether the rebuild reads local rows or calls the provider API)
and potentially the schema (whether a `stale` column is added to
`daily_priced_rollups`).

## What Must Be Decided Before P-060 Is Implemented

1. **Retention window**: how long to keep intervals locally (indefinitely,
   rolling N days, none after rollup, or something else).
2. **Rebuild source**: whether P-060's rebuild path reads local `interval_readings`
   or re-fetches from the provider.
3. **Stale flag**: whether a `stale` column (or equivalent) is added to
   `daily_priced_rollups` and how it is surfaced in the UI.

## Relationship To Other Decisions

- This decision revisits the "raw intervals remain source of truth" clause in
  decision 0008. If Option B or C is adopted, decision 0008 should be amended to
  reflect the changed retention model.
- P-060 (invalidate and rebuild rollups after tariff edits) is directly blocked
  on this decision — its acceptance criteria assume a rebuild source that has
  not yet been chosen.
