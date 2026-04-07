# Range History Screen — Direction Spec

## Purpose

This document specifies the UX design for the Range History screen in `apps/web`.
It covers the module hierarchy, period selector behaviour, chart design constraints,
all state variants, and the free import slot extension point.

This is the design source of truth for U-041, U-042, U-043, and U-044. It is a
written direction spec — not a clickable prototype and not a code spec.

---

## Primary Question

> How am I doing over time, and what did it cost or save me?

Range History leads with financial outcome and solar contribution before breaking
down into energy charts. The period selector is always visible and always reflects
the current context.

---

## Period Selector

### Data loading strategy

The page makes **one fetch on load**: the full 365-day window ending today. All
period changes are handled client-side by adjusting the ECharts `dataZoom` range
— no additional API calls are made when the user switches presets or sets a
custom range.

This is appropriate because the maximum dataset is 366 daily summary rows — a
trivially small payload. The single-fetch model means period changes feel
instantaneous and no loading state is needed after the initial page load.

> **KPI row re-aggregation:** because period changes do not trigger a re-fetch,
> the KPI row values must be recomputed client-side from the already-loaded daily
> summaries whenever the zoom window changes. Implementers must not cache or
> hard-code KPI totals from the server response.

### Named presets

The default interaction is choosing a named preset. Presets are first-class
controls — not a dropdown hidden behind a "filter" affordance.

| Preset label | Zoom window applied to loaded data |
|---|---|
| Last 7 days | Today − 6 days → today |
| Last 30 days | Today − 29 days → today |
| Last 3 months | Today − 89 days → today |
| Last 12 months | Today − 364 days → today (full dataset) |
| This month | First of current calendar month → today |
| This year | 1 Jan of current year → today |

Default preset on first load: **Last 30 days**.

### Custom range

Custom date range is a **secondary path**, not the default:

- Desktop: a date-range picker opens inline or in a popover when the user
  selects "Custom range"
- Mobile: a "Custom" overflow button appears at the end of the preset pill row;
  tapping it opens a full-screen or sheet date picker

Custom range replaces the active preset label with a formatted date string
(e.g. `12 Mar – 6 Apr 2025`). The preset pills deselect when a custom range is
active. Custom ranges are clamped to the loaded 365-day window — dates outside
this range are not selectable.

### Sticky selector

The period selector (§1) is **pinned to the top of the viewport** and remains
visible as the user scrolls through the charts below. This means the user can
always change the period without scrolling back to the top.

On desktop the sticky bar contains the preset pills, the "Custom range" control,
and the trust / last-updated strip. On mobile it contains the scrollable pill row
and trust strip. The sticky bar has a solid background and a subtle bottom border
or shadow to separate it from the scrolling content beneath.

Height must be reserved for the sticky bar so the first non-sticky module (§2
KPI row) is not obscured when the page loads.

### Chart zoom synchronization

All time-series charts (§4, §5, §6, §8, §9) share a **single synchronized zoom
state**. When the period changes — whether by preset or custom range — all charts
update their visible window simultaneously. No chart is left showing a different
date range from the others.

ECharts `dataZoom` instances across charts should be linked. The period selector
drives the shared zoom state; individual chart-level drag-to-zoom is disabled to
prevent charts falling out of sync.

---

## Module Hierarchy

All modules appear in the order below on both desktop and mobile. The section
numbers are stable references used in chart design notes and the state matrix.

### Desktop layout

Modules stack vertically. The KPI row (§2) and tariff-change callout (§3) sit
above the fold on typical 1280 px+ viewports.

| § | Module | Notes |
|---|---|---|
| 1 | Period selector + trust / last-updated strip | Sticky — pinned to top of viewport while scrolling; contains preset pills, custom range control, and trust strip |
| 2 | KPI row | Savings €, Actual cost €, No-solar cost €, Export credit €, Avg solar coverage % |
| 3 | Tariff-change callout | Shown only when `health.hasTariffChange` is true; sits between the KPI row and the first chart — never buried below charts |
| 4 | Energy trend line chart | Import vs generation, toggleable series |
| 5 | Per-day stacked bar chart | Import total \| generation breakdown: generated-consumed / exported / immersion |
| 6 | Financial cost histogram | Per-day actual net cost vs without-solar cost, side-by-side bars |
| 7 | Period cost breakdown chart | Donut: import cost / fixed charges / export credit / solar savings |
| 8 | Solar coverage area chart | Daily % of consumption met by solar |
| 9 | Export ratio chart | Daily % of generated energy that was exported |
| 10 | Payback progress bar | Cumulative savings vs finance payments — financed installations only |

### Mobile layout

Same module order as desktop. All modules are full-width and vertically stacked.

- Period selector: a horizontal scrollable row of pill presets with a "Custom"
  button at the end
- Trust strip: single line beneath the preset row
- KPI row: cards in a 2-column grid (2 × 2 + 1 wide for the fifth card)
- Charts §4–§9: full-width, with chart title and legend above each chart
- Payback bar §10: full-width, shown only for financed installations

---

## KPI Row — Field Definitions

| KPI | Field | Format | Notes |
|---|---|---|---|
| Savings | `savings` | €X.XX | Actual net cost minus without-solar net cost |
| Actual cost | `actualNetCost` | €X.XX | Import cost + fixed charges − export credit |
| No-solar cost | `withoutSolarNetCost` | €X.XX | What the bill would have been without solar |
| Export credit | `actualExportCredit` | €X.XX | Revenue from exported generation |
| Avg solar coverage | `avgSelfConsumptionRatio` | XX% | Mean of daily `self_consumption_ratio` values in the period |

When tariff data is absent, all five KPI cards become prompt cards (see
[No-tariff / savings-locked](#no-tariff--savings-locked) state). The energy-only
KPI variant (import kWh, export kWh, generated kWh) is not shown as a fallback —
energy totals appear in the charts below.

---

## Chart Design Notes

### Chart library

All charts use **ECharts**, consistent with the existing Live and Historical Day
screens. Do not introduce a second charting library for this screen.

### §4 — Energy trend line chart

- Two toggleable series: **Import** (kWh/day) and **Generation** (kWh/day)
- Both series active by default
- X-axis: local dates in the selected range
- Y-axis: kWh
- When a day has no summary data, the line breaks at that point (gap, not zero)
- Legend controls which series are visible — toggling is a client-side operation

### §5 — Per-day stacked bar chart

**Import bar (left bar per day):**

- Default (no rate-band data): a single-colour bar for total daily import kWh
- When rate-band data is available from P-039 (`dayImportKwh`, `peakImportKwh`,
  `nightImportKwh`): the bar is split into three segments — Night (bottom),
  Day (middle), Peak (top) — with distinct colours
- Label the bar "Import" in the legend; add sub-labels for bands only when band
  data is active

**Generation bar (right bar per day):**

Three stacked segments:

1. **Generated-consumed** — solar used directly (bottom)
2. **Exported** — solar sent to grid (middle)
3. **Immersion diverted** — solar sent to hot water (top)

> **Drop the v1 "Overall Gen" third bar.** The generation-breakdown stack already
> communicates total generation. A separate overall-generation bar is redundant
> and should not be reintroduced.

**Missing days:** leave the day's slot empty (no bar) rather than showing a zero
bar.

### §6 — Financial cost histogram

- Two side-by-side bars per day: **Actual net cost** and **Without-solar net cost**
- Both use banded billing when P-039 rate-band data is available in the range API
- When falling back to day-rate-only billing, add a subdued label beneath the
  chart title: *"Cost calculated using day rate only"*
- Days with no tariff data for any interval are excluded; a note appears if any
  days are excluded from the chart

### §7 — Period cost breakdown donut

Segments (in clockwise order from top):

1. Import cost
2. Fixed charges (standing charge + PSO levy)
3. Export credit (shown as a negative or offset segment)
4. Solar savings

**Free import slot:** Reserve a visual segment position for free import (free
Saturday hours or equivalent). Label it *"Free import (not active)"* in a muted
style when no free-import rule is configured. Do not hide the slot entirely — the
layout should not need redesigning when free import is activated. See
[Free Import Slot](#free-import-slot) below.

When tariff data is missing, replace the donut with a prompt card.

### §8 — Solar coverage area chart

- Area chart: X-axis = local date, Y-axis = % of daily consumption met by solar
  (0–100 %)
- Derived from `self_consumption_ratio` per daily summary
- When a day's value is null or the day has no data, break the area at that point
- Shaded area below the line; line colour contrasts with the import series in §4

### §9 — Export ratio chart

- Area or line chart: X-axis = local date, Y-axis = % of generated energy exported
  (0–100 %)
- Derived from `export_kwh / generated_kwh` per daily summary
- Hidden entirely when no generation data exists for the selected period (i.e.
  `generated_kwh` is zero or null for all days in the range)
- When a day has no generation data, break the line at that point

### §10 — Payback progress bar

- **Shown only for financed installations** (`finance_mode = 'finance'`). Hidden
  entirely for cash installations — not greyed out, not collapsed with a
  placeholder.
- Content: cumulative savings to date vs total finance cost (install cost financed
  over `finance_term_months` months)
- Within the selected period: net savings earned vs finance payments due in that
  period
- Two figures beneath the bar: *"Saved so far"* and *"Total financed"*

---

## State Matrix

### Loading

Loading applies only to the **initial page fetch** (the full 365-day dataset).
Subsequent period changes are zoom-only and have no loading state.

- Each module shows a skeleton placeholder that reserves the module's approximate
  height during the initial fetch
- The sticky period selector (§1) remains visible and interactive during loading;
  preset changes made before data arrives are applied immediately when the data
  lands
- The page does not reflow when data arrives (reserved heights prevent layout
  shift)

### Empty — no data for this range

Distinguish two sub-cases:

| Sub-case | Message |
|---|---|
| Range predates installation history | *"No data before [earliest available date]. Try a more recent range."* |
| Range is within history but has no imported summaries | *"No data for this period. Check the Data Health screen if you expected data here."* |

In both sub-cases, all chart modules show the empty message rather than empty
axes.

### Partial — some days missing

- Totals in the KPI row exclude missing days
- A callout beneath the KPI row (or beneath §3 if a tariff-change callout is
  also present) lists the count of missing days: *"X days in this range have no
  data and are excluded from totals."*
- Charts show gaps at missing day positions rather than zeroes
- The trust strip indicates the last successful sync date

### Tariff-change

- The tariff-change callout (§3) appears **between the KPI row and the first
  chart** when `health.hasTariffChange` is true
- Content: *"Tariff changed during this period — [version change date(s)]"*
- The callout is tappable / expandable to show the version names and effective
  dates
- It must not be positioned below the charts where it would be missed

### No-tariff / savings-locked

When no tariff version covers any part of the selected period:

- KPI cards §2: replaced with a single prompt card reading *"Add a tariff to
  see cost and savings"* with a CTA linking to the Tariffs setup screen
- Financial charts (§6, §7): replaced with prompt cards using the same message
- Energy charts (§4, §5) and solar/export charts (§8, §9) remain fully usable —
  energy data does not require tariff configuration
- Payback bar (§10): hidden (same condition as cash installations)

When tariff data covers only part of the range:

- Show financial totals for the covered days only
- Add a note beneath the KPI row: *"Financial data covers X of Y days. Add
  tariff history to extend coverage."*

### Hard error

- All modules are replaced by a single full-width error card:
  *"Something went wrong loading this period. Try again."*
- A retry button re-triggers the data fetch without resetting the selected preset
- The period selector remains visible and interactive above the error card

---

## Free Import Slot

Free import (free Saturday hours or equivalent) is **not active in v1** because
the `free_import_rule_json` tariff field schema has not yet been formally defined.
However, the visual layout must reserve space for it so the screen does not need
redesigning when it is activated.

### Where the slot appears

- **§5 — Per-day stacked bar chart:** A fourth import segment labelled *"Free
  import"* is reserved at the base of the import bar (below Night). When not
  active, the bar renders without this segment — the slot is not shown as an
  empty or greyed-out layer in v1.
- **§7 — Period cost breakdown donut:** A segment labelled *"Free import (not
  active)"* is shown in a muted/ghost style when no free-import rule is
  configured, reserving its position in the legend and donut arc sequence.

### Activation condition

Free import segments activate when the resolved tariff version for a day contains
a non-null `free_import_rule_json` with a valid rule structure. Classification
logic is deferred to a follow-up story.

### Design constraint

The §7 donut legend must have a stable segment order that includes the free import
position. Do not design the donut assuming only four segments — the fifth must fit
without a layout change.

---

## What This Spec Unlocks

| Story | Dependency satisfied |
|---|---|
| `U-041` | Page shell, period selector, summary header, trust strip, and KPI row have unambiguous module order, field definitions, and state behaviour |
| `U-042` | Energy charts (§4 and §5) have precise series definitions, stacking rules, gap behaviour, and the v1 third-bar drop is documented |
| `U-043` | Financial charts (§6 and §7) have banded-billing rules, fallback labelling, and the free import slot position in the donut |
| `U-044` | Solar coverage (§8), export ratio (§9), and payback bar (§10) have rendering conditions, hidden states, and data derivation rules |

---

## References

- [FE-006 feature overview](/docs/features/FE-006.md)
- [Mid-fi layout spec — Range History section](/docs/ui/mid-fi-layouts.md)
- [P-039 — Rate-band import breakdown in daily summaries](/docs/stories/todo/P-039.md)
- [U-041 — Range History page shell, period selector, and summary header](/docs/stories/todo/U-041.md)
