# Solar Stats User Journeys

This document captures the primary product journeys that should drive the first
wireframes and the data contracts behind them.

## Journey 1: Understand what is happening right now

User goal:

- answer "what is my system doing right now, and is the data fresh?"

Entry points:

- landing page value proposition
- signed-in Overview
- signed-in Live

Happy path:

1. User opens the app.
2. User sees a high-level summary on Overview with current trust status.
3. User opens Live for more detail.
4. User confirms current generation, import, export, consumption, and coverage.
5. User sees freshness timestamp and any warning state.

Critical decisions:

- Is the data fresh enough to trust?
- Am I currently leaning on the grid or self-consuming well?

Fallback states:

- stale data warning
- provider outage
- current-day partial data

## Journey 2: Review yesterday or a specific day

User goal:

- understand how a single day behaved and what it likely cost or saved

Entry points:

- Overview shortcut
- History day view
- notable-day link from another summary

Happy path:

1. User opens a day view, usually yesterday.
2. User sees headline totals first.
3. User scans an interval chart to understand import/export/generation timing.
4. User sees the daily bill-impact summary and no-solar comparison.
5. User leaves with a clear mental model of that day.

Critical decisions:

- Was this a good or bad day financially?
- When did the household rely on the grid most?

Fallback states:

- missing day
- partial day
- tariff version changed during or around the selected period

## Journey 3: Understand a week, month, year, or custom period

User goal:

- answer "how am I doing over time?"

Entry points:

- Overview
- History range view

Happy path:

1. User selects a preset or custom range.
2. User sees summary KPIs before charts.
3. User compares actual cost, export value, no-solar cost, and savings.
4. User uses a trend chart to spot patterns.
5. User understands whether the chosen period was strong, weak, or unusual.

Critical decisions:

- Is solar materially reducing my bill over this period?
- Is export helping enough, or am I too grid-reliant?

Fallback states:

- insufficient history
- period spans a tariff change
- custom range too broad for detailed interval views

## Journey 4: First-time setup

User goal:

- complete enough setup to make the product useful without feeling overwhelmed

Entry points:

- approved signup
- first sign-in after invite

Happy path:

1. User accepts terms and enters the onboarding flow.
2. User sees that only provider connection is required, while the remaining setup steps can be skipped and completed later.
3. User connects the provider.
4. User can optionally enter installation profile, tariff, and finance details, or skip them.
5. User lands on an Overview that shows setup completion progress and the value still locked behind missing details.
6. User can immediately use live data views even if tariff or finance details were skipped.

Critical decisions:

- What information is required now versus later?
- What does each input affect in the reporting?
- Is it worth skipping this step now and coming back later?

Fallback states:

- provider credentials rejected
- tariff incomplete
- user chooses to skip a non-critical field
- installation date unknown, so backfill defaults to adaptive discovery later

## Journey 4a: Complete setup later to unlock more value

User goal:

- move from "I can see live data" to "I can trust savings, payback, and historical reporting"

Entry points:

- setup progress card on Overview
- locked savings card
- Settings or Tariffs area

Happy path:

1. User opens the setup progress surface.
2. User sees completed steps, remaining steps, and what each missing step unlocks.
3. User adds tariff details to unlock savings cards and historical comparisons.
4. User adds finance details to unlock payback reporting.
5. User adds installation date and array capacity to improve backfill scope and efficiency indicators.

Critical decisions:

- Which missing step matters most to the insight I want next?
- Should I add an approximate installation date now or let the system infer the backfill boundary?

Fallback states:

- user only wants live monitoring and leaves setup partially complete
- tariff details still missing, so savings remain intentionally hidden behind a prompt card

## Journey 5: Update tariff rates or contract details

User goal:

- keep the financial model trustworthy when a tariff changes

Entry points:

- Tariffs overview
- reminder banner
- Data Health or Overview warning

Happy path:

1. User opens Tariffs.
2. User sees the current version, historical versions, and reminder status.
3. User creates or edits a tariff version.
4. User confirms validity dates and contract review dates.
5. User understands whether recalculation is needed and what periods are affected.

Critical decisions:

- Am I correcting history or entering a future/current tariff?
- Will this change affect historical savings numbers?

Fallback states:

- overlapping validity ranges
- missing export rate or fixed-charge detail
- expired tariff validity with no replacement

## Journey 6: Understand trust and data health

User goal:

- know whether the app's conclusions are safe to rely on

Entry points:

- banner on Overview, Live, or History
- dedicated Data Health page

Happy path:

1. User sees a warning or trust badge.
2. User opens Data Health for detail.
3. User sees last sync, missing days, provider issues, and backfill status.
4. User understands whether the issue is informational, blocking, or actionable.
5. User takes the next step or returns to the dashboard with confidence.

Critical decisions:

- Is this just delayed data or a real outage?
- Do I need to reconnect something or wait for a backfill?

Fallback states:

- provider unreachable
- current-day feed stale
- historical gaps detected
- installation date unknown, so the system is still discovering the practical historical boundary

## Journey 7: Understand the product before signup

User goal:

- decide whether the app is relevant and trustworthy enough to request access

Entry points:

- landing page
- beta access page

Happy path:

1. User lands on the product site.
2. User understands the core promise: bill impact, solar value, tariff-aware savings, and payback.
3. User sees supported setup expectations.
4. User requests beta access.

Critical decisions:

- Does this support my setup?
- Will this answer a financial question I actually care about?

Fallback states:

- unsupported provider
- beta closed
- application received, awaiting review
