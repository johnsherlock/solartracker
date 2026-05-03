# Decision Record 0008: Range History Performance via Incremental Loading and Priced Daily Rollups

## Status

Accepted

## Date

2026-05-02

## Context

`Range History` currently reads and prices raw half-hour `interval_readings`
directly on page load.

That model improved financial accuracy after the move away from
`daily_summaries`, because each interval can now be priced against the tariff
that applied at that exact time of day. However, it also moved a large amount
of compute into the request path for the `/range` screen.

The current page load now does all or most of the following before first paint:

- resolves the signed-in installation context
- loads the visible range interval rows
- loads tariff versions and fixed-charge versions
- computes a full priced day-level range summary from the raw interval rows
- may also load all available history again for the finance/payoff context
- may also recompute a second all-time summary just to derive cumulative
  recovery figures

This makes the page slow to start painting, even though much of the screen can
be understood without waiting for every finance and payoff section to finish.

We also expect tariff edits to remain possible. That means any cached or rolled
up priced data must be invalidatable and rebuildable from raw interval data.

## Decision

Range History performance will be improved using two complementary strategies:

1. incremental page loading for the signed-in `/range` experience
2. a database-backed priced daily rollup derived from raw half-hour intervals

### Decided now

1. The page does not need to render as one fully-blocking unit.
   - The screen should start painting as soon as the shell and first useful
     range data are ready.
   - Secondary sections such as all-time finance/payoff context may load later.

2. Raw `interval_readings` remain the source of truth.
   - We are not reversing the interval-based data model.
   - Raw half-hour data must remain available so historically priced outputs
     can be rebuilt when tariff definitions change.

3. Range History should stop reading raw interval rows directly for its normal
   day-level reporting path.
   - Instead, the app should read from a derived daily priced summary layer.
   - That layer may be implemented as a table, materialized view, or equivalent
     persisted rollup, as long as it can be rebuilt deterministically from raw
     interval data and current tariff history.

4. The derived daily rollup should store the day-level outputs the range page
   actually needs, not just raw energy totals.
   - This includes tariff-priced values such as:
     - import cost
     - export credit/value
     - self-consumed solar value
     - counterfactual without-solar import cost
     - fixed charges
     - daily net-cost / savings outputs
   - It should also retain the raw day-level energy totals needed by charts and
     KPIs.

5. Dynamic tariff price periods do not block this rollup approach.
   - The range page does not need to surface individual price periods as a
     first-class daily reporting dimension.
   - The rollup can price each half-hour interval at its applicable tariff slot
     and then store the day-total outputs needed by the page.

6. Tariff edits must invalidate and asynchronously rebuild affected rollups.
   - If tariff versions, price periods, schedules, or fixed charges change for
     historical dates, the derived daily priced summaries covering those dates
     become stale.
   - Rebuild should happen asynchronously from raw `interval_readings`.

7. `All` mode is explicitly out of scope for the first performance pass.
   - The first optimization wave should target the default and normal bounded
     range experiences.

## Consequences

### Product consequences

- The screen can start painting much earlier, improving perceived performance.
- Finance/payoff modules can remain accurate while no longer blocking the first
  usable render.
- Users should experience the page as progressively filling in rather than
  waiting for a single long blank load.

### Data-model consequences

- The rewrite will maintain both:
  - raw half-hour interval data as source of truth
  - derived day-level priced summaries for fast range/history reads
- Tariff-aware recomputation becomes an explicit maintenance concern rather than
  something hidden inside each page request.

### Operational consequences

- Tariff edit flows must identify affected date ranges and trigger rollup
  invalidation/rebuild.
- The daily-summary ingestion path should also write or refresh the derived
  priced daily summary for the captured day.

## Explicitly Deferred

1. Full optimization of `All` mode
2. Pushing the entire slot-pricing/reporting pipeline into ad hoc SQL at
   request time
3. Deeper client-side chart-hydration tuning unless server/data improvements
   still leave the page feeling slow

## Relationship To Other Decisions

- This decision builds on the interval-based source-of-truth direction that was
  established when `daily_summaries` were replaced by half-hour
  `interval_readings`.
- It complements `FE-015` by preserving tariff accuracy while restoring a fast
  day-level reporting path for Range History.
