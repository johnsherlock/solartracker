# Solar Stats Hi-Fi Spec — Core Signed-In Screens

This document is the high-fidelity design specification for the four core signed-in
product screens: Overview, Live, Daily History, and Range History.

It translates the layout hierarchy, module composition, and state rules from
`docs/ui/mid-fi-layouts.md` into concrete visual decisions — exact copy, named color
roles, type scale labels, component names, and specific layout proportions. These
decisions form the visual baseline for `U-024` (prototype), `U-025` (design tokens),
and `U-026` (implementation specs).

Source inputs:

- `docs/ui/mid-fi-layouts.md`
- `docs/ui/data-contracts.md`
- `docs/ui/screen-inventory.md`

This spec does not introduce new layout hierarchy, module priority, or backend
data-contract decisions. If hi-fi exploration reveals a structural problem, it should
be captured as an explicit note for review rather than silently corrected here.

Implementation technology context: `apps/web` uses Next.js App Router, Tailwind CSS,
shadcn/ui components, lucide-react icons, and Recharts. Visual decisions in this spec
are shaped to translate cleanly into that stack.

---

## Visual Design Foundations

### Typography Scale

All screens share a single type scale. Sizes are relative descriptors; `U-025` will
bind these to specific `rem` values and Tailwind classes.

| Role | Usage | Weight | Size descriptor |
|---|---|---|---|
| `display` | Primary KPI values, large financial figures | Bold | ~3xl–4xl |
| `headline` | Section labels, card titles, screen headings | Semibold | ~xl–2xl |
| `body` | Explanatory text, helper copy, interpretation panels | Regular | base |
| `body-sm` | Metadata, timestamps, secondary notes, badge text | Regular | sm |
| `label` | Form field labels, chart axis labels, card sub-labels | Medium | sm |
| `caption` | Footnotes, caveats, source notes, legal-adjacent copy | Regular | xs |

Rules:

- `display` appears only once per screen section — never two competing display-size values in the same viewport row
- Card titles use `headline`; card values use `display`; card support text uses `body-sm`
- Trust and freshness timestamps always use `body-sm` or `caption`, never `body`
- Warning messages use `body`; warning labels use `label`

### Color Roles

Semantic color roles only. `U-025` will assign Tailwind color tokens and dark/light
variants to each role.

| Role | Meaning | Example uses |
|---|---|---|
| `surface` | Default page background | Page body |
| `surface-raised` | Card and panel backgrounds | KPI cards, interpretation panels |
| `surface-inset` | Recessed / input backgrounds | Chart backgrounds, form fields |
| `on-surface` | Primary text on surface | Body copy, KPI labels |
| `on-surface-muted` | Secondary text on surface | Timestamps, support text, captions |
| `brand-primary` | Solar generation signal | Generation metric, chart series |
| `positive` | Savings, export, healthy outcome | Savings card value, export series, trust-positive badge |
| `warning` | Stale data, partial data, setup-incomplete prompt | Trust badge stale state, warning banners, prompt card border |
| `destructive` | Hard errors, provider disconnected | Error cards, disconnected trust badge |
| `neutral` | Grid, import, no-solar comparison | Import series, no-solar cost card |
| `trust-positive` | Data is fresh and reliable | Trust badge fresh state |
| `locked` | Gated modules and prompt card backgrounds | Prompt cards replacing locked metrics |
| `on-locked` | Text and icons on locked/prompt backgrounds | Prompt card copy, lock icon |

Usage rules:

- `positive` and `destructive` are never used decoratively — only for data-meaningful states
- `warning` conveys incomplete or delayed, not broken; `destructive` conveys broken or disconnected
- Chart series use: generation → `brand-primary`, consumption → `neutral`, import → `neutral` (dimmer shade), export → `positive`
- Background hierarchy: page uses `surface`; cards use `surface-raised`; chart plot areas use `surface-inset`

### Spacing Rhythm

Four named rhythm steps:

| Name | Base unit | Usage |
|---|---|---|
| tight | 4px | Between inline elements within a card (icon + label, badge + text) |
| regular | 8px | Between card sub-sections (label to value, value to support text) |
| comfortable | 16px | Card internal padding; between items within a module group |
| loose | 24–32px | Between major layout sections; between card rows |

Rules:

- Every card uses `comfortable` internal padding on all sides
- Adjacent cards in a row use `comfortable` gap
- Between major layout zones (trust strip, KPI row, secondary row) use `loose` gap
- No section should have zero visible breathing room; minimum gap is `regular`

### Card Anatomy

All metric cards share a consistent four-area anatomy:

```
┌──────────────────────────────────────────┐
│ [Label]              [Status badge?]     │  ← Header area (label, body-sm / label role)
│                                          │
│  €24.60                                  │  ← Value area (display role)
│                                          │
│  vs €41.20 without solar  ↓ -40%        │  ← Support area (body-sm, muted)
│                                          │
│  → View tariff breakdown                 │  ← Footer area (optional; label role, link)
└──────────────────────────────────────────┘
```

Rules:

- Value area is always the visual center of gravity — no competing large text nearby
- Support area is optional; omit rather than leaving blank space
- Footer area is optional; use only when a relevant action exists
- A prompt card occupies identical dimensions to the metric card it replaces to prevent layout shift

### Prompt Card Anatomy

Prompt cards replace locked metric cards when required data is missing.

```
┌──────────────────────────────────────────┐
│  🔒 Savings                              │  ← Header: lock icon + metric name (label)
│                                          │
│  Add tariff details to see savings       │  ← Explanation (body-sm, on-locked)
│  for this period.                        │
│                                          │
│  [ Add tariff details → ]                │  ← CTA (button, routes to specific setup step)
└──────────────────────────────────────────┘
```

Rules:

- Explanation copy must say what is missing, not just that it is locked
- CTA must route to the specific setup step that resolves the lock — never to a generic settings page
- Background uses `locked` role; text uses `on-locked`; border uses `warning` at reduced opacity
- Never show a zero, a dash, or a placeholder number in a locked metric card

### Chart Styling Direction

Shared chart rules for all screens:

- One primary chart per screen section — no two equally prominent charts in the same viewport
- Chart container uses `surface-raised` background with `comfortable` padding
- Plot area uses `surface-inset` background
- Series colors:
  - Generation → `brand-primary`
  - Consumption → `neutral` (medium shade)
  - Import → `neutral` (dimmer shade, clearly subordinate to consumption)
  - Export → `positive`
- Axes: minimal — time on x-axis, value on y-axis with unit suffix (W, kWh, €)
- Grid lines: horizontal only, subtle (`on-surface-muted` at low opacity), not dominant
- Legend: inline within the chart card, compact, toggleable per series
- Tooltip: shows all visible series values at the hovered/tapped time point; uses `surface-raised` background
- Empty state: centered message in plot area — "No data for this period" — no fake axes
- Stale state: desaturate all series; overlay a timestamp annotation on the x-axis end; "Data delayed as of [time]"
- Time-resolution toggle: compact segmented control inside the chart card header, not in the page header
- Recharts implementation note: use `ResponsiveContainer` for all charts; prefer `AreaChart` for trend data, `BarChart` for period breakdown

### Trust and Warning State Components

Three trust/warning components shared across all screens:

**Trust badge** (compact pill, near top of every data-bearing screen):

| State | Label | Color role |
|---|---|---|
| `fresh` | Updated [X seconds/minutes] ago | `trust-positive` |
| `stale` | Last seen [X minutes/hours] ago | `warning` |
| `partial` | Partial data — [X days] missing | `warning` |
| `disconnected` | Provider disconnected | `destructive` |

**Warning banner** (full-width, below header, for screen-level issues):

- Appears only when the issue affects the whole screen, not just one module
- Structure: warning icon + calm specific message + one CTA link
- Uses `warning` background role at low opacity; `on-surface` text
- Example: "Live data appears delayed — historical summaries remain accurate. [Review Data Health →]"
- Tone is always calm and specific — never "Error" or "Something went wrong"

**Inline card warning** (within a single card when only that module is affected):

- Small `warning` badge or border on the affected card only
- Support area shows the specific issue text
- Does not trigger a full warning banner

---

## Screen Specs

---

## Overview

### Rationale

Overview is the default signed-in landing screen. Its primary question is:
**"Am I saving money, and can I trust what I am seeing?"**

The hi-fi treatment makes the period financial outcome immediately legible before the
user reads anything else. Trust and freshness are surfaced as a secondary but unmissable
signal — never buried below the fold.

Provider-only users (no tariff data entered) must still arrive at a coherent, useful
screen. The live snapshot card remains fully usable, and savings/payback cards are
replaced by calm prompt cards rather than empty or broken states.

The screen is summary-first. No chart is required in v1 Overview — the interpretation
panel carries the explanatory load.

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAV: [Installation name]    [Date range: This month ▾]   [User ▾]  │
├─────────────────────────────────────────────────────────────────────┤
│ TRUST STRIP: ● Updated 4 minutes ago              [Review health →] │
├─────────────────────────────────────────────────────────────────────┤
│ SETUP STRIP (conditional):  ──●──●──○──○  2 of 4 steps complete    │
│   Next: Add tariff details to unlock savings  [Continue setup →]    │
├────────────────┬────────────────┬────────────────┬──────────────────┤
│  Savings       │  Without solar │  Actual cost   │  Export value    │
│  €24.60        │  €41.20        │  €16.60        │  €3.80           │
│  this month    │  this month    │  this month    │  earned          │
├────────────────┴────────────────┴────────────────┴──────────────────┤
│  PAYBACK                                                             │
│  ████████████████████░░░░░░░░░░░░░  68% · Est. payback Jan 2028    │
├──────────────────────────────────┬──────────────────────────────────┤
│  LIVE SNAPSHOT (compact)         │  INTERPRETATION PANEL            │
│  ↑ 2.1 kW generating             │  This month you generated enough  │
│  ↓ 0.3 kW importing              │  solar to cover 60% of your home  │
│  ↑ 0.8 kW exporting              │  use. Your grid costs were €16.60 │
│  Updated 4 min ago               │  compared to €41.20 without       │
│  [View Live →]                   │  solar — a saving of €24.60.      │
├──────────────────────────────────┴──────────────────────────────────┤
│  SHORTCUTS: [Live ▸]  [Yesterday ▸]  [Last 30 days ▸]  [Tariffs ▸] │
└─────────────────────────────────────────────────────────────────────┘
```

Layout rules:
- Nav bar: `surface-raised`, full-width, `comfortable` padding
- Trust strip: `surface` background, `body-sm`, badge pill left-aligned
- Setup strip: conditional — hidden when all recommended steps complete; uses `warning` accent on the progress indicator incomplete steps
- KPI row: 4-column grid, equal widths; cards use `surface-raised`, `comfortable` padding, `loose` gap between rows
- Payback card: full-width, progress bar uses `brand-primary` fill on `surface-inset` track
- Secondary row: 50/50 two-column; `surface-raised` cards; `comfortable` internal padding
- Shortcuts: horizontal row of text links with chevron; `body-sm`, `on-surface-muted`

### Mobile Layout

```
┌─────────────────────────────────┐
│ NAV: [Installation] [📅] [👤]  │
├─────────────────────────────────┤
│ ● Updated 4 minutes ago         │
├─────────────────────────────────┤
│ SETUP CARD (conditional):       │
│ 2 of 4 steps · Next: Tariff     │
│ [Continue setup →]              │
├─────────────────────────────────┤
│ LIVE SNAPSHOT                   │
│ ↑ 2.1 kW  ↓ 0.3 kW  ↑ 0.8 kW  │
│ Updated 4 min ago  [View Live]  │
├─────────────────────────────────┤
│ Savings        €24.60           │
├─────────────────────────────────┤
│ Without solar  €41.20           │
├─────────────────────────────────┤
│ Actual cost    €16.60           │
├─────────────────────────────────┤
│ Export value   €3.80            │
├─────────────────────────────────┤
│ PAYBACK  ████████░░░░  68%      │
│ Est. payback Jan 2028           │
├─────────────────────────────────┤
│ INTERPRETATION                  │
│ This month you covered 60% of   │
│ home use with solar, saving     │
│ €24.60 vs no-solar scenario.    │
│ [Show more ▾]                   │
├─────────────────────────────────┤
│ [Live] [Yesterday] [30 days]    │
│ [Tariffs]  →→→ (scroll)         │
└─────────────────────────────────┘
```

Layout rules:
- Live snapshot appears before financial KPIs on mobile — immediately useful for provider-only users
- KPI cards are full-width stacked; value right-aligned to label within the same row card
- Interpretation panel is collapsible on small screens — "Show more / Show less" toggle
- Shortcuts are a horizontally scrollable row of chips

### State Variants

#### Healthy / Default

- All four KPI cards show real computed values
- Trust badge state: `fresh` (green-adjacent `trust-positive` role)
- Payback card: progress bar + "Est. payback [Month Year]"
- Interpretation panel: positive framing — leads with savings achievement
- Setup strip: hidden if setup is complete

#### Setup-Incomplete (no tariff data)

- Savings card → prompt card: "🔒 Savings — Add tariff details to see your savings for this period. [Add tariff details →]"
- Payback card → prompt card: "🔒 Payback — Add finance details to track your payback progress. [Add finance details →]"
- No-Solar Cost card → remains visible as a standalone metric (no tariff needed to show this label; keep visible for context, or omit if it creates confusion without savings — prefer omit, show only Actual Cost and Export Value in the 4-column row)
- Live snapshot renders fully — provider-only experience is coherent and useful
- Setup strip is visible and elevated (not dismissible until setup is complete)
- Interpretation panel text adapts: "Your system is generating and feeding to the grid. Add tariff details to see what you're saving."

#### Stale / Warning

- Trust badge state: `stale` (`warning` role)
- Warning banner appears: "Live data appears delayed — your historical summaries remain accurate. [Review Data Health →]"
- All financial KPI cards remain visible using last-available summary data
- Live snapshot shows last-known values with explicit elapsed-time stamp: "Last seen 2 hours ago"
- Interpretation panel remains visible; add a `caption`-level note: "Based on data as of [date/time]"

#### Hard Error

- KPI row: all four metric cards replaced by a single full-width error card: "Unable to load your data right now. [cause summary]. [Try again →] or [Reconnect provider →]"
- Payback card hidden
- Live snapshot shows last-known values if available, or shows provider-disconnected state
- Trust badge state: `disconnected` (`destructive` role)
- Nav and Setup shortcuts remain fully accessible — navigation is not blocked

---

## Live

### Rationale

Live's primary question is:
**"What is my system doing right now, and is this data fresh?"**

The hi-fi emphasises realtime power-flow — the four current metrics — as the first thing
a user sees after the nav. Financial framing is secondary and deliberately kept below
the realtime data. Freshness is so prominent that a stale state is immediately obvious
without the user hunting for it.

Provider-only users get the full Live experience. Capacity-dependent features (efficiency)
are silently omitted when installation capacity is not configured — no warning, no empty
state, no visual gap.

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAV: Live                      ↻ Auto-refreshing    [User ▾]        │
├─────────────────────────────────────────────────────────────────────┤
│ TRUST STRIP: ● Updated 12 seconds ago                               │
├─────────────────┬─────────────────┬────────────────┬────────────────┤
│  Generation     │  Consumption    │  Import        │  Export        │
│  2,140 W        │  920 W          │  310 W         │  810 W         │
│  ↑ from panels  │  home using now │  from grid     │  to grid       │
├─────────────────┴─────────────────┴────────────────┴────────────────┤
│  COVERAGE BAR                                                        │
│  Solar ████████████████░░░░░░░░░░░░░  Grid                          │
│  85% of your home is running on solar right now                     │
├─────────────────────────────────────────────────────────────────────┤
│  LIVE TREND CHART (last 30 min)                     [5min | 15min]  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  kW                                                         │   │
│  │  3 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │  2 ──[generation]─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                │   │
│  │  1 ─ ─ ─ ─ ─ ─ ─ ─ ─[consumption]─ ─ ─ ─ ─ ─              │   │
│  │  0 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  └─────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────┬──────────────────────────────────┤
│  TODAY SO FAR                    │  NOTES                           │
│  Generated    14.2 kWh           │  ⚠ Today's totals are still     │
│  Consumed      9.8 kWh           │    accumulating — check back     │
│  Imported      1.6 kWh           │    after midnight for the full   │
│  Exported      4.4 kWh           │    day summary.                  │
│                                  │  Efficiency: 78% of 18 kWp max  │
│  [View full day →]               │  [View Data Health →]            │
└──────────────────────────────────┴──────────────────────────────────┘
```

Layout rules:
- Auto-refresh indicator: subtle animated icon in the nav bar; `body-sm`, `on-surface-muted`
- Trust strip: identical position to Overview; `body-sm`; badge immediately below the nav
- Metrics row: 4-column grid; values use `display` role; support text uses `caption`
- Coverage bar: full-width; `brand-primary` fill for solar portion, `neutral` fill for grid portion; percentage label below
- Live trend chart: `surface-raised` card; `surface-inset` plot area; time-resolution toggle in chart card header top-right; legend compact inline; chart uses Recharts `AreaChart`
- Today totals: left column of secondary row; label–value pairs in `body` / `headline` rhythm
- Notes column: right column of secondary row; uses inline card warning component for partial-day notice; efficiency line present only when capacity data exists

### Mobile Layout

```
┌─────────────────────────────────┐
│ NAV: Live    ↻ 12s ago  [👤]   │
├─────────────────────────────────┤
│ ● Updated 12 seconds ago        │
├─────────────┬───────────────────┤
│ Generation  │ Consumption       │
│ 2,140 W     │ 920 W             │
├─────────────┼───────────────────┤
│ Import      │ Export            │
│ 310 W       │ 810 W             │
├─────────────┴───────────────────┤
│ COVERAGE BAR                    │
│ Solar ██████░░░░  Grid          │
│ 85% on solar right now          │
├─────────────────────────────────┤
│ LIVE TREND CHART                │
│ [5min | 15min]                  │
│ ┌───────────────────────────┐   │
│ │ ~~~ chart ~~~             │   │
│ └───────────────────────────┘   │
│ (horizontally scrollable)       │
├─────────────────────────────────┤
│ TODAY SO FAR                    │
│ Generated   14.2 kWh            │
│ Consumed     9.8 kWh            │
│ Imported     1.6 kWh            │
│ Exported     4.4 kWh            │
│ [View full day →]               │
├─────────────────────────────────┤
│ ⚠ Totals still accumulating    │
│ Efficiency: 78% of 18 kWp max   │
│ [View Data Health →]            │
└─────────────────────────────────┘
```

Layout rules:
- Metrics use a 2×2 grid; each cell is a half-width card; `comfortable` padding
- Live trend chart is full-width and horizontally scrollable if the time window exceeds the viewport
- Today-totals and notes sections are full-width stacked, not side by side

### State Variants

#### Healthy / Default

- All four current-power metrics display live W/kW values with `display` type
- Trust badge: `fresh` state, `trust-positive` color
- Coverage bar: animated; fills in real time
- Trend chart: all four active series; tooltip live on hover/tap
- Efficiency metric visible in notes column only if `arrayCapacityKw` is populated

#### Setup-Incomplete (provider-only, no capacity)

- Efficiency metric is silently absent from the notes column — no placeholder, no message
- All four core metrics render fully
- No setup progress prompt appears on the Live screen — provider-only users get the full realtime experience
- Today-totals render normally

#### Stale / Warning

- Trust badge: `stale` state, `warning` color; freshness stamp: "Last seen 18 minutes ago"
- Warning banner appears below trust strip: "Live data is delayed. Your system was last seen 18 minutes ago. [Review Data Health →]"
- All four current-power metrics display last-known values with stale visual treatment: desaturated, `on-surface-muted` text, small clock icon
- Trend chart: series desaturated; x-axis end annotated "Data delayed" in `warning` color; data shown up to last-available point
- Coverage bar: frozen at last-known state; `warning` border

#### Provider Disconnected

- Full current-metrics area replaced by a single centered error card: "[Provider name] is not connected. [cause description: e.g. 'Credentials may have expired.']. [Reconnect →] or [Troubleshoot →]"
- Coverage bar hidden
- Live trend chart hidden
- Secondary row (today-totals + notes) hidden
- Trust badge: `disconnected`, `destructive` color
- Nav remains accessible

---

## Daily History

### Rationale

Daily History's primary question is:
**"What happened on this day, and what did it likely cost or save me?"**

The hi-fi cleanly separates energy understanding (what physically happened: generation,
import, export, consumption) from financial interpretation (what it cost relative to a
no-solar scenario). A user without tariff data gets full energy value — the energy
totals row is never locked. The financial row is where prompt cards appear.

The day chart is secondary to the summary rows. It explains and confirms — it does not
lead. A user should be able to answer the primary question from the two summary rows
alone without looking at the chart.

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAV: [← Yesterday]  Thursday 20 March 2025  [Tomorrow →]   ● fresh │
├──────────────┬────────────────┬────────────────┬────────────────────┤
│ Generation   │ Consumption    │ Import         │ Export             │
│ 18.4 kWh     │ 11.2 kWh       │ 1.6 kWh        │ 7.2 kWh            │
│ today        │ used           │ from grid      │ to grid            │
├──────────────┴────────────────┴────────────────┴────────────────────┤
│  Actual cost      No-solar cost      Savings                        │
│  €3.20            €14.80             €11.60                         │
│  what you paid    what you'd pay     you saved                      │
├─────────────────────────────────────────────────────────────────────┤
│  DAY CHART                                               [Legend ▾] │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  kWh                                                        │   │
│  │  3 ─[generation]─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │  2 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─[consumption]─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │  1 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─[import]─ ─[export]─   │   │
│  │  0 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │     06:00       09:00       12:00       15:00       18:00   │   │
│  └─────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────┬──────────────────────────────────┤
│  DAY STORY                       │  NOTES                           │
│  Strong generation, low grid     │  ✓ Full day data available       │
│  use. You covered 86% of your    │  Efficiency: 82% of 22 kWp max  │
│  home with solar and exported    │                                  │
│  7.2 kWh back to the grid,       │                                  │
│  earning a €1.80 export credit.  │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

Layout rules:
- Date header: previous/next navigation using `←` / `→` icon-buttons; date in `headline`; trust badge inline right
- Energy totals row: 4-column grid, identical to Overview KPI row; uses `body-sm` caption under each value; no financial information in this row
- Financial comparison row: 3-column grid; values use `headline` (slightly smaller than energy `display` to maintain hierarchy); savings value uses `positive` color
- Day chart: `surface-raised` card; generation and consumption as primary series (heavier weight); import and export as secondary series (lighter weight/opacity); Recharts `AreaChart` or `ComposedChart`; x-axis shows hourly labels; legend toggle in card header top-right
- Day story: left column; `body` text; 2–4 sentences; no financial copy if tariff is missing
- Notes: right column; trust/completeness state; efficiency if capacity exists; `body-sm`

### Mobile Layout

```
┌─────────────────────────────────┐
│ [←] Thursday 20 Mar 2025 [→]   │
│ ● fresh data                    │
├─────────────────────────────────┤
│ Generation   18.4 kWh           │
│ Consumption  11.2 kWh           │
│ Import        1.6 kWh           │
│ Export        7.2 kWh           │
├─────────────────────────────────┤
│ Actual cost   €3.20             │
│ No-solar cost €14.80            │
│ Savings       €11.60            │
├─────────────────────────────────┤
│ DAY CHART                       │
│ ┌───────────────────────────┐   │
│ │ ~~~ chart ~~~             │   │
│ └───────────────────────────┘   │
├─────────────────────────────────┤
│ Strong generation, low grid     │
│ use. You covered 86% of your    │
│ home with solar.                │
├─────────────────────────────────┤
│ ✓ Full data  Efficiency: 82%   │
└─────────────────────────────────┘
```

Layout rules:
- Date nav: `←` and `→` as inline tap targets flanking the date; both targets at least 44px tap area
- Energy cards: full-width list style (label + value on same row, right-aligned value); `comfortable` row padding
- Financial cards: same list style; savings row uses `positive` color on value
- Day chart: full-width; no horizontal scroll needed for a single-day view
- Day story and notes: stacked; notes condensed to one line where possible

### State Variants

#### Healthy / Default

- Energy totals row: all four values populated
- Financial comparison row: all three values populated; savings value in `positive` color
- Day chart: all four series visible; full-interval detail
- Day story: positive or neutral framing with specific numbers; "Strong generation, low grid use" or "Cloudy day — grid covered most demand"
- Notes: "✓ Full day data available"; efficiency if capacity exists

#### Setup-Incomplete (no tariff)

- Energy totals row: renders fully — not gated
- Financial comparison row: all three cards replaced by a single full-width prompt card spanning the 3-column row: "🔒 Cost and savings — Add tariff details to see the financial impact of this day. [Add tariff details →]"
- Day chart: renders normally on energy data only; no financial overlays or annotations
- Day story: omits financial commentary; "Your system generated 18.4 kWh and covered 86% of home use."
- Notes: shows normal completeness state; no financial caveats needed

#### Partial Day (today or historically incomplete)

- Date header: append "(In progress)" label in `body-sm`, `warning` color when the day is the current calendar day
- Energy total cards: show accumulating values with "(so far)" suffix in `caption` role; e.g. "14.2 kWh (so far)"
- Financial cards: show partial estimates with "(estimate)" suffix and a `caption` note: "Final cost will be confirmed when the day completes"
- Day chart: renders the portion of the day with data; future hours shown as greyed-out `surface-inset` area with a subtle "Remaining" label
- Day story: uses softer language — "Your system has generated 14.2 kWh so far today"

#### Hard Error / Missing Day

- Energy totals area: all cards replaced by a single centered error card
  - If day is before installation: "No data — this day is before your installation date."
  - If day has no provider history: "No data available for this day. Provider history may not extend this far back."
  - If retrieval failure: "Could not load data for this day. [Try again →]"
- Financial comparison row: hidden
- Day chart: hidden
- Day story and notes: hidden

---

## Range History

### Rationale

Range History's primary question is:
**"How am I doing over time, and what pattern best explains the result?"**

The hi-fi leads with the period financial outcome — the KPI row — before any breakdown
or chart detail. The key takeaway sentence sits visibly between the KPIs and the chart
so the user reads the conclusion before the evidence. The trend chart is explanatory
and comes after the answer, not before.

Tariff-change events and missing-data gaps are surfaced as tappable flags near the
chart — important but tertiary. They do not compete with the KPI row for attention.

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAV: Range History                                     [User ▾]     │
├─────────────────────────────────────────────────────────────────────┤
│ RANGE CONTROLS:                                                      │
│ [Last 7 days]  [Last 30 days]  [This month]  [Last 3 months]       │
│ [Custom range...]              1 Mar – 20 Mar 2025  (20 days)      │
├────────────────┬────────────────┬────────────────┬──────────────────┤
│  Total savings │  Actual cost   │  No-solar cost │  Export value    │
│  €156.20       │  €89.40        │  €245.60       │  €44.80          │
│  this period   │  you paid      │  without solar │  earned          │
├─────────────────────────────────────────────────────────────────────┤
│  KEY TAKEAWAY                                                        │
│  You saved €156.20 this period — equivalent to 64% of your         │
│  estimated without-solar bill.                                      │
├─────────────────────────────────────────────────────────────────────┤
│  TREND CHART — Daily savings, 1–20 Mar 2025          [Day | Week]  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  €                                                          │   │
│  │ 15 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │ 10 ─ ─ ─ ─[daily savings bars]─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │  5 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │   │
│  │     3 Mar  5 Mar  7 Mar  ▲tariff  10 Mar  12 Mar  ...      │   │
│  └─────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────┬──────────────────────────────────┤
│  BREAKDOWN                       │  PERIOD FLAGS                    │
│  [By day | By week | By month]   │  ▲ Tariff changed 8 Mar 2025    │
│                                  │    Rates updated. Prior days     │
│  Date       Savings   Cost       │    calculated at old rate.       │
│  20 Mar     €9.20     €3.80      │    [View tariff history →]       │
│  19 Mar     €8.10     €4.40      │                                  │
│  18 Mar     €7.80     €5.20      │  ✓ All 20 days have full data   │
│  ...                             │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

Layout rules:
- Range controls: first-class segmented/chip controls across the full width; "Custom range..." opens a secondary date-range picker without replacing the presets; selected preset/range clearly highlighted
- KPI row: 4-column grid identical to Overview; `loose` gap above from range controls
- Key takeaway panel: full-width; `surface-raised` card; `headline` or `body` text; moderately elevated — not as large as `display` but larger than body
- Trend chart: `surface-raised` card; Recharts `BarChart` for daily savings; time-resolution toggle (Day/Week) in card header; tariff-change events shown as inline vertical markers on x-axis with `▲` label
- Breakdown: left column of secondary row; toggleable view (by day/by week/by month); table layout; `body-sm` rows
- Period flags: right column; list of annotations; tariff-change events, missing-data gaps; each flag tappable to expand explanation

### Mobile Layout

```
┌─────────────────────────────────┐
│ NAV: Range History      [👤]   │
├─────────────────────────────────┤
│ RANGE CONTROLS (scroll →→→)     │
│ [7d] [30d] [This mo] [3mo] [+] │
│ 1 Mar – 20 Mar 2025             │
├─────────────────────────────────┤
│ Total savings  €156.20          │
│ Actual cost     €89.40          │
│ No-solar cost  €245.60          │
│ Export value    €44.80          │
├─────────────────────────────────┤
│ KEY TAKEAWAY                    │
│ You saved €156.20 — 64% of     │
│ your estimated without-solar    │
│ bill this period.               │
├─────────────────────────────────┤
│ TREND CHART                     │
│ [Day | Week]                    │
│ ┌───────────────────────────┐   │
│ │ ~~~ daily savings bars ~~ │   │
│ └───────────────────────────┘   │
├─────────────────────────────────┤
│ BREAKDOWN   [Day | Week | Mo]   │
│ 20 Mar   €9.20    €3.80        │
│ 19 Mar   €8.10    €4.40        │
│ ...                             │
├─────────────────────────────────┤
│ PERIOD FLAGS                    │
│ ▲ Tariff changed 8 Mar 2025    │
│ [Learn more ▾]                  │
│ ✓ Full data for all 20 days    │
└─────────────────────────────────┘
```

Layout rules:
- Range presets are a horizontally scrollable chip row; `[+]` opens the custom range picker
- KPI cards are full-width list-style (same as Daily History mobile)
- Key takeaway is full-width below KPIs
- Trend chart is full-width; horizontal scroll if daily bars exceed viewport width
- Breakdown and flags are stacked full-width

### State Variants

#### Healthy / Default

- All four KPI cards populated with period totals
- Key takeaway: positive framing — "You saved €X this period — equivalent to Y% of your estimated without-solar bill."
- Trend chart: daily savings bars with `positive` fill; tariff-change markers inline on x-axis if applicable
- Breakdown: shows full period rows
- Period flags: tariff changes noted if present; "✓ Full data for all N days" if complete

#### Setup-Incomplete (no tariff)

- All four KPI cards → replaced by a single full-width prompt card spanning the row: "🔒 Financial summary — Add tariff details to see savings, costs, and export value for this period. [Add tariff details →]"
- Key takeaway adjusts: "Energy overview for 1–20 Mar 2025. Add tariff details for financial analysis."
- Trend chart: switches to energy-volume view (daily generation and import bars) rather than savings; clearly labelled: "Daily energy (kWh) — financial view requires tariff details"
- Breakdown: shows energy totals per day (generation, import, export) without cost columns
- Period flags: data-completeness flags still shown

#### Partial Range (includes missing days)

- KPI row totals display with a `caption`-level footnote: "Based on 17 of 20 days — 3 days excluded due to missing data"
- Totals use `warning`-adjacent treatment on the value labels: small asterisk or "(partial)" suffix
- Period flags panel prominently lists the missing days: "⚠ 3 days excluded: 5 Mar, 11 Mar, 14 Mar"
- Trend chart shows gaps as breaks in the bar series; broken bars use `surface-inset` fill with a subtle `warning` border
- Key takeaway includes the exclusion: "You saved at least €138.40 over 17 complete days — 3 days are not included."

#### Stale

- Trust badge in the range header (or a brief trust strip): "Summaries may not include the most recent data"
- KPI row renders normally with last-available data — no values hidden
- Period flags: "Latest sync: [X hours/days] ago" noted as a flag
- Trend chart: most recent bars may appear dimmed with a `caption` note on the chart: "Data current as of [date]"

---

## Appendix: State Comparison Table

Quick reference for which modules change per screen and state.

| State | Overview | Live | Daily History | Range History |
|---|---|---|---|---|
| Healthy | All modules visible | All metrics live | All rows + chart | All KPIs + chart |
| Setup-incomplete | Savings + payback → prompt cards | Efficiency silently omitted | Financial row → prompt card | KPI row → single prompt card |
| Stale / warning | Warning banner; live snapshot frozen | Warning banner; metrics desaturated; chart annotated | Low relevance for past days; partial-day label if today | Trust note; most recent bars dimmed |
| Hard error | KPI area → single error card | Metrics area → connection error card | All content → single error card | n/a (see partial) |
| Provider disconnected | Live snapshot → disconnected state | Full screen error card | n/a | n/a |

---

## Open Questions

These questions emerged during hi-fi spec work and are recorded for review rather than
silently resolved:

1. **Overview chart deferral** — Mid-fi deferred whether Overview should include a small
   chart module. This spec keeps Overview chart-free in v1 as intended. If later review
   suggests a sparkline-style summary chart would help, it should be scoped explicitly
   into a subsequent story before being added.

2. **Export value without tariff** — Range History setup-incomplete state assumes export
   value is also locked (export rate is part of tariff data). This should be confirmed
   against the data contract: if export value can be shown without a full tariff plan,
   the prompt card scope should be narrowed to savings only.

3. **Range History — no-solar cost display** — When tariff data is missing, no-solar
   cost is meaningless. The spec replaces all four financial KPIs with one prompt card.
   If there is a case where no-solar cost can be shown independently, the card behaviour
   should be revisited.

4. **Daily History partial-day today handling** — The "(In progress)" label and greyed
   future chart area are specified here but were not detailed in mid-fi. This should be
   validated against the data contract for `currentDataStatus` and whether a "day in
   progress" state is a distinct backend status or inferred client-side from the date.
