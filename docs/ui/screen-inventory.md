# Solar Stats Screen Inventory

This document defines the initial screen inventory for the UI-first discovery phase.
It is intentionally low fidelity. The goal is to make the product surface area explicit
before we commit more backend work.

## Navigation Model

Top-level navigation for the signed-in product:

- Overview
- Live
- History
- Tariffs
- Data Health
- Settings

Supporting routes and unauthenticated surfaces:

- Landing / beta access
- Signup / login / terms acceptance
- Onboarding flow

## Canonical Screen List

### Public / unauthenticated

#### 1. Landing page

Purpose:

- explain the product clearly before signup
- show that the product is about financial understanding, not raw telemetry alone
- encourage beta access requests

Primary content:

- product value proposition
- simple explanation of live data, savings, tariff-awareness, and payback
- supported setup expectations
- beta access request CTA

Key states:

- normal marketing state
- beta access closed / waitlist

#### 2. Beta access request

Purpose:

- capture enough context to decide if the user is a fit for beta

Primary content:

- email
- provider/setup summary
- meter/tariff notes
- privacy/trust expectations

Key states:

- success confirmation
- validation error

#### 3. Signup / login / terms

Purpose:

- let approved users create an account and understand the privacy boundary

Primary content:

- auth choice
- invite / approval state
- terms acceptance
- privacy and deletion summary

Key states:

- invite valid
- invite expired
- approval pending
- auth error

### Signed-in product

#### 4. Overview

Purpose:

- answer the main product question quickly: "am I saving money and can I trust this?"

Primary content:

- bill impact summary
- actual vs no-solar comparison
- export value
- payback progress
- trust/health summary
- shortcuts into live and history

Key states:

- fully configured
- first-run empty state
- partial setup
- stale data warning

#### 5. Live

Purpose:

- show what the installation is doing right now with strong trust cues

Primary content:

- latest generation / consumption / import / export
- freshness timestamp
- current solar coverage
- live trend or recent interval view
- current-day headline totals

Key states:

- fresh
- stale
- provider warning
- no live feed yet

#### 6. Daily history

Purpose:

- help the user understand a single day's story and cost impact

Primary content:

- daily totals
- interval trend
- import/export/generation/consumption summary
- daily savings and no-solar comparison
- notable events or warnings

Key states:

- normal past day
- current day in progress
- partial day
- missing day

#### 7. Range history

Purpose:

- explain longer-term patterns and financial outcome across week, month, year, or custom range

Primary content:

- summary KPIs
- comparison vs no-solar
- trend charts
- best/worst period markers
- clear date range controls

Key states:

- preset range
- custom range
- spans tariff change
- insufficient data

#### 8. Tariffs overview and history

Purpose:

- show what rates applied when and whether the setup is still trustworthy

Primary content:

- current tariff summary
- version timeline
- contract reminder status
- last review / expiry cues

Key states:

- single current tariff
- multiple historical versions
- expired validity
- contract review due

#### 9. Tariff version editor

Purpose:

- let users add or correct tariff versions without ambiguity

Primary content:

- supplier / plan metadata
- rate fields
- validity window
- contract dates
- retrospective correction guidance

Key states:

- create
- edit
- overlap / validation conflict
- successful save with recalculation impact messaging

#### 10. Data Health

Purpose:

- make trust and troubleshooting visible instead of hidden in the dashboard

Primary content:

- last successful sync
- stale data indicators
- missing / partial days
- provider errors
- backfill or retry status

Key states:

- healthy
- warning
- error
- backfill running

#### 11. Settings and privacy

Purpose:

- give users control over installation metadata and account/privacy concerns

Primary content:

- installation profile
- locale / timezone
- provider reconnect
- notification preferences
- account deletion

Key states:

- connected
- provider revoked
- deletion requested

### Guided flow screens

#### 12. Onboarding: installation setup

Purpose:

- capture home and solar context needed for useful reporting

Primary content:

- installation name
- timezone
- locale / currency
- finance mode and payback inputs

#### 13. Onboarding: provider connection

Purpose:

- connect the supported provider and verify the connection

Primary content:

- provider choice
- credential entry
- test connection
- supported-provider explanation

#### 14. Onboarding: tariff setup

Purpose:

- capture the current tariff accurately enough for meaningful savings reporting

Primary content:

- supplier and plan
- rate inputs
- export settings
- validity and contract dates

## Screen-State Requirements

Every signed-in screen should explicitly define:

- loading state
- empty / first-run state
- stale or partial-data warning state
- hard error state

Trust-sensitive screens should also define:

- last updated timestamp
- source/provider context where relevant
- what action the user should take when the data is incomplete
