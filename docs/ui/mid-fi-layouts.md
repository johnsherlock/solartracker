# Solar Stats Mid-Fidelity Layout Spec

This document is the mid-fidelity bridge between the low-fi planning artifacts and
later high-fidelity mockups. It locks layout hierarchy, module composition, copy
structure, interaction rules, and state behavior for the first-wave product screens.

Source inputs:

- `docs/ui/screen-inventory.md`
- `docs/ui/wireframes.md`
- `docs/ui/data-contracts.md`

This is not a visual-design document and not a frontend implementation spec. It
exists so later design and build work does not need to re-decide product structure.

## Screen Index

First-wave screens covered in this spec:

- Overview
- Live
- Daily History
- Range History
- Onboarding and setup
- Tariffs and contract management
- Data Health

Out of scope for U-020:

- admin approvals
- gifted access management
- annual wrap-up
- AI or forecast-led later features
- whitelabel/provider-admin extensions

## Shared Layout Rules

### Product-wide structure

- Overview remains the default signed-in landing screen.
- Desktop layouts should use a clear top-to-bottom reading order with no more than two major columns below the primary summary row.
- Mobile layouts should stack primary-answer modules before any explanatory or secondary modules.
- Trust and freshness must appear near the top of every data-bearing screen.
- Setup progress is a persistent product concept, not just an onboarding detail.

### Content hierarchy

- Primary modules answer the screen's main question immediately.
- Secondary modules explain, compare, or add confidence.
- Tertiary modules handle navigation, education, or lower-frequency actions.
- Avoid dense "all metrics at once" dashboard treatment; group metrics into meaningful blocks.

### Interaction rules

- Date selection should use explicit presets plus a custom range path, not a single overloaded picker.
- Edit entry points should be visible but secondary on read-heavy screens.
- State-changing actions should be placed close to the module they affect.
- When a required prerequisite is missing, show a prompt card with a clear CTA instead of an empty metric or fake default value.

### State rules

Every applicable screen must define:

- loading
- empty / first-run
- stale
- partial
- setup-incomplete
- hard error

Trust-sensitive states should always say:

- what is wrong
- what remains usable
- what the user should do next, if anything

### Copy guidance

- Headline copy should be question- or outcome-led rather than system-led.
- Helper text should explain why a field or number matters, not restate the label.
- Warning tone should be calm and specific, never alarmist.
- CTA labels should describe the next action plainly, such as `Add tariff details`, `Review data health`, or `Reconnect provider`.

## Shared Module Library

The same module types should recur across screens so later high-fi work has a stable pattern set.

### Summary KPI row

Purpose:

- deliver the main answer immediately

Use on:

- Overview
- Daily History
- Range History

Rules:

- 3 to 5 KPI cards maximum in the first visible row
- no tiny supporting text that requires interpretation to find the main answer

### Prompt / unlock-more card

Purpose:

- explain why a capability is unavailable and what unlocks it

Use on:

- Overview
- Daily History
- Range History
- onboarding review

Rules:

- say what is locked
- say what data is missing
- offer one clear CTA

### Trust / health card

Purpose:

- summarize freshness, completeness, and operational trust

Use on:

- Overview
- Live
- Daily History
- Range History
- Data Health

Rules:

- show last update
- show highest-severity current issue
- link to fuller detail when needed

### Trend chart block

Purpose:

- show change over time after the headline answer is already clear

Use on:

- Live
- Daily History
- Range History

Rules:

- one primary chart per screen section
- avoid multiple equally dominant charts in the same viewport

### Explanation / interpretation panel

Purpose:

- translate numbers into meaning

Use on:

- Overview
- Range History
- Tariffs

Rules:

- should answer "why this matters" in plain language
- should not become a dumping ground for every caveat

### Timeline / history list

Purpose:

- make time-based changes readable

Use on:

- Tariffs Overview
- Data Health

Rules:

- newest or current item first unless historical continuity matters more
- current status should be visually obvious

### Form step block

Purpose:

- keep setup/edit flows understandable and low-pressure

Use on:

- onboarding
- tariff version editor

Rules:

- explain which fields are optional
- explain what each step unlocks if skipped

## Screen Layouts

## Overview

Primary question:

- Am I saving money, and can I trust what I am seeing?

### Desktop layout zones

1. Header bar
2. Setup progress / unlock-more strip
3. Primary KPI row
4. Primary interpretation panel
5. Secondary two-column row: live snapshot and trust/health
6. Shortcut row

### Mobile layout zones

1. Header bar
2. Setup progress / unlock-more card
3. Live snapshot card
4. Primary KPI cards in stacked order
5. Interpretation panel
6. Trust/health card
7. Shortcuts

### Required modules

Primary:

- savings or savings-locked card
- no-solar comparison
- export value
- payback or payback-locked card

Secondary:

- setup progress
- interpretation panel
- live snapshot
- trust/health summary

Tertiary:

- shortcuts into Live, yesterday, range history, and Tariffs

### Interaction notes

- date range control belongs in the header, scoped to overview-compatible ranges
- setup progress CTA should route into the next most valuable missing setup step
- trust card CTA should route to Data Health
- savings/payback cards should link to Tariffs or setup when gated

### State rules

- Loading: keep layout skeletons stable; reserve top row space for KPI cards
- Empty: emphasize provider setup completion and explain what appears after first sync
- Stale: keep historical financial summaries visible if still valid, but elevate freshness warning
- Partial: show a caution banner plus indicate which periods are incomplete
- Setup-incomplete: replace savings/payback with prompt cards; keep live snapshot usable
- Hard error: replace data modules with a single clear failure summary and recovery paths

### Conditional rendering

- If tariff data is missing, show `Add tariff details to see savings` in place of savings-related metrics
- If finance data is missing, show `Add finance details to track payback` in place of payback
- If installation capacity is missing, do not show efficiency comparisons here

### Content guidance

- Headline should focus on the period outcome, not system status
- Helper copy should explain the meaning of `no-solar` in plain language
- Warning copy should separate `data delayed` from `data unreliable`

### Clarifications from low-fi

- Overview should be summary-first, not chart-first
- Live snapshot belongs above financial interpretation on mobile because it reinforces immediate usefulness for provider-only users
- The screen should prefer one interpretation panel over several competing explanatory blocks

## Live

Primary question:

- What is my system doing right now, and is this data fresh?

### Desktop layout zones

1. Header with freshness and status
2. Current metrics row
3. Solar coverage / grid reliance bar
4. Primary live trend chart
5. Secondary two-column row: current-day totals and warnings/source notes

### Mobile layout zones

1. Header with freshness and status
2. Current metrics grid
3. Coverage bar
4. Primary live trend chart
5. Current-day totals
6. Warning / source notes

### Required modules

Primary:

- current generation
- current consumption
- current import
- current export
- freshness indicator

Secondary:

- solar coverage / grid reliance
- primary trend chart
- current-day totals

Tertiary:

- efficiency vs theoretical output when capacity exists
- provider/source notes

### Interaction notes

- time-resolution toggle belongs inside the chart module, not in the page header
- deep link to Daily History should use `today`
- warning CTA should route to Data Health when the issue is operational

### State rules

- Loading: metrics placeholders first, chart second
- Empty: explain that provider connection succeeded but live data is not yet available
- Stale: keep last-known values, but visibly time-stamp them as old
- Partial: explain that current-day totals may still grow or may be missing intervals
- Setup-incomplete: live remains usable with provider-only setup; no lock state needed beyond optional efficiency omission
- Hard error: show provider issue summary with reconnect or troubleshoot CTA

### Conditional rendering

- If installation capacity exists, show efficiency as a secondary metric
- If capacity is missing, omit efficiency silently rather than showing a warning
- Avoid a savings-oriented pie chart as a dominant live module; keep financial framing secondary to realtime state

### Content guidance

- Headline should emphasize `Live now`
- Freshness copy should use plain elapsed-time language
- Warning tone should distinguish `delayed`, `suspicious`, and `disconnected`

### Clarifications from low-fi

- Keep one primary chart only; do not give equal weight to multiple large charts
- The low-fi pie-chart idea should be demoted or deferred because it competes with the main realtime question

## Daily History

Primary question:

- What happened on this day, and what did it likely cost or save me?

### Desktop layout zones

1. Date header with navigation and trust state
2. Energy totals row
3. Financial comparison row
4. Primary day chart
5. Secondary two-column row: day story and warnings

### Mobile layout zones

1. Date header
2. Energy totals cards
3. Financial comparison cards or prompt cards
4. Day chart
5. Day story
6. Warnings

### Required modules

Primary:

- import, generation, export, and consumption totals
- actual cost
- no-solar cost
- savings

Secondary:

- export credit
- day chart
- day story / highlights

Tertiary:

- efficiency indicator when capacity exists
- trust/warning notes

### Interaction notes

- previous/next date controls stay in the header
- chart legend toggles belong inside the chart card
- a CTA from the savings prompt should route directly to Tariffs

### State rules

- Loading: preserve date-nav placement so the page does not jump
- Empty: explain whether the missing day is before install, before provider history, or just absent
- Stale: low relevance for past days unless source corrections are pending
- Partial: explicitly say whether the day is still in progress or historically incomplete
- Setup-incomplete: replace financial cards with tariff prompt cards, keep energy totals usable
- Hard error: show retrieval failure with retry guidance

### Conditional rendering

- If tariff data is missing, energy totals remain visible and bill-impact modules become prompt cards
- If capacity data exists, show efficiency after the primary energy and financial summaries
- If the selected day is today, use softer language around incompleteness

### Content guidance

- Lead with a short day summary such as `Strong generation, moderate grid use`
- Warning text should clarify whether a limitation affects cost interpretation or only completeness

### Clarifications from low-fi

- Split energy totals and financial impact into separate rows to reduce overload
- Keep the chart singular and explanatory rather than introducing many competing graphics

## Range History

Primary question:

- How am I doing over time, and what pattern best explains the result?

### Desktop layout zones

1. Range header with presets and custom range control
2. KPI row
3. Key takeaway / interpretation panel
4. Primary trend chart
5. Secondary two-column row: breakdown module and period flags

### Mobile layout zones

1. Range controls
2. KPI cards
3. Key takeaway
4. Trend chart
5. Breakdown
6. Flags / warnings

### Required modules

Primary:

- range savings
- range actual cost
- range no-solar cost
- range export value

Secondary:

- key takeaway
- trend chart
- breakdown by day/week/month

Tertiary:

- tariff-change flag
- missing-data flag
- performance vs theoretical output when capacity exists

### Interaction notes

- presets should be first-class controls
- custom range should open a secondary control flow, not dominate the header
- tariff-change and missing-data flags should be tappable to explain impact

### State rules

- Loading: maintain selected preset/custom context while data loads
- Empty: explain whether the range predates history or has no imported data
- Stale: indicate if summaries may lag backfill or corrections
- Partial: explain which days are missing and whether totals exclude them
- Setup-incomplete: replace savings-focused metrics with prompt cards when tariff data is missing
- Hard error: collapse to a single failure summary with retry path

### Conditional rendering

- If tariff data is missing, show energy/trend usefulness without pretending to know financial value
- If capacity data exists, show performance vs theoretical output after the primary financial outcome
- If the range spans a tariff change, surface that near the KPI row, not buried in footnotes

### Content guidance

- Key takeaway should summarize the period in one sentence
- Use explanatory labels rather than raw analytics jargon

### Clarifications from low-fi

- The range view should prioritize financial interpretation before breakdown detail
- Avoid more than one major chart in the first viewport

## Onboarding And Setup

Primary question:

- What is the minimum I need to do now, and what more can I add later?

### Flow structure

1. Provider connection
2. Installation setup
3. Tariff setup
4. Finance / payback setup
5. Review / first entry

### Shared flow rules

- Provider connection is the only required step
- Every later step must explain what capability it unlocks
- Skip actions should be explicit and guilt-free
- Setup progress should persist after onboarding and reappear on Overview and Settings

## Provider Connection

### Desktop and mobile layout zones

1. Step header with required marker
2. Provider selection and credential form
3. Test connection result area
4. Continue CTA

### Required modules

Primary:

- provider choice
- credential inputs
- test connection result

Secondary:

- supported-provider explanation

### State rules

- Loading: disable continue until test result resolves
- Empty: normal pre-entry form state
- Stale: not applicable
- Partial: invalid or incomplete credentials
- Setup-incomplete: this screen itself is the required incomplete state
- Hard error: connection test failure with specific recovery guidance

## Installation Setup

Primary question:

- What optional context improves my reporting quality?

### Layout zones

1. Optional-step header
2. Installation profile fields
3. Helper text about why date and capacity matter
4. Save and skip actions

### Required modules

Primary:

- installation name
- installation date
- array capacity

Secondary:

- timezone
- locale / currency

### State rules

- Setup-incomplete: allow continue without saving
- If installation date is unknown, explain inferred backfill behavior
- If capacity is unknown, explain that efficiency indicators will remain hidden

## Tariff Setup

Primary question:

- What do I need to add to unlock savings?

### Layout zones

1. Optional-step header
2. Tariff form
3. Explanation of unlocked capabilities
4. Save and skip actions

### Required modules

Primary:

- supplier and plan
- day/night/peak/export rates
- validity dates

Secondary:

- contract reminder dates
- helper copy on historical accuracy

### State rules

- Setup-incomplete: skipping keeps savings locked but preserves live and energy views
- Partial: incomplete tariff form should clearly identify missing required fields for saving
- Hard error: save failure should preserve entered values

## Finance / Payback Setup

Primary question:

- What do I need to add to unlock payback tracking?

### Layout zones

1. Optional-step header
2. Finance mode fields
3. Payback explanation
4. Save and skip actions

### State rules

- Skipping leaves payback locked but does not affect savings if tariff data exists
- Avoid implying payback is required for the core product

## Review / First Entry

Primary question:

- What can I use now, and what can I unlock later?

### Layout zones

1. Completion summary
2. Unlocked capabilities list
3. Locked capabilities list
4. Primary CTA to Overview

### Clarifications from low-fi

- The review step should feel like permission to start, not pressure to complete everything

## Tariffs And Contract Management

Primary question:

- What rates applied when, and what needs my attention?

## Tariffs Overview

### Desktop layout zones

1. Header with current tariff identity
2. Current status summary row
3. Version timeline / history list
4. Secondary two-column row: contract detail and actions

### Mobile layout zones

1. Header
2. Current tariff summary
3. Reminder / warning card
4. Version history list
5. Actions

### Required modules

Primary:

- current tariff summary
- version history / timeline

Secondary:

- reminder status
- contract details

Tertiary:

- add version
- edit current
- review expired rates

### State rules

- Empty: explain that savings remain locked until tariff setup exists
- Stale: highlight expired validity or overdue review
- Setup-incomplete: treat missing tariff as a guided setup opportunity
- Hard error: preserve action entry points even when history fails to load

### Clarifications from low-fi

- Current status and history should be separated so the user can quickly tell `what is true now` versus `what changed before`

## Tariff Version Editor

Primary question:

- Am I adding or correcting rates without breaking history?

### Layout zones

1. Edit header with mode: create or edit
2. Core tariff fields
3. Validity and contract section
4. Recalculation impact panel
5. Save / cancel actions

### Required modules

Primary:

- supplier/plan metadata
- rates
- validity window

Secondary:

- contract dates
- recalculation impact note

### State rules

- Partial: highlight overlapping validity or missing required fields inline
- Hard error: preserve unsaved inputs
- Success: confirmation should explain whether historical reporting may change

## Data Health

Primary question:

- Can I trust the data, and what exactly needs attention?

### Desktop layout zones

1. Overall health header
2. Health summary row
3. Issue list / timeline
4. Backfill scope and progress
5. Action guidance

### Mobile layout zones

1. Overall health summary
2. Issue cards
3. Backfill section
4. Action guidance

### Required modules

Primary:

- overall health status
- last successful sync
- provider state

Secondary:

- missing / partial days
- backfill scope summary
- current issue list

Tertiary:

- action guidance
- reconnect or retry entry points

### Interaction notes

- warnings on Overview or Live should deep-link into the relevant Data Health section
- backfill language should explain why the chosen start boundary exists

### State rules

- Empty: unusual, but explain if no health history exists yet
- Stale: communicate whether the app is usable despite delay
- Partial: identify affected periods
- Setup-incomplete: if installation date is missing, explain inferred boundary behavior without blocking usage
- Hard error: distinguish product load failure from provider-health issues

### Clarifications from low-fi

- Data Health should feel diagnostic and actionable, not like an internal log screen

## Open Questions And Deferred Items

- Whether Overview should eventually expose a small chart module remains intentionally deferred to high-fi review
- Whether Live needs a secondary efficiency mini-chart should be validated later, not locked here
- The exact visual treatment of setup progress is deferred to high-fidelity design
- Public landing, beta access, and signup deserve high-fidelity design later, but this spec does not expand them beyond structural relevance to onboarding
- Future premium and engagement features should reuse these layout rules but are intentionally excluded from this first-wave mid-fi pass
