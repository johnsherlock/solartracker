# Solar Stats UI Data Contracts

This document captures the data each planned screen requires so backend work can
be shaped by UI needs rather than the other way around.

## Cross-Screen Requirements

Every signed-in view should be able to render:

- trust status
- last updated timestamp
- empty state
- loading state
- stale / partial-data warning
- hard error state

Shared trust/health fields:

- `lastSuccessfulSyncAt`
- `currentDataStatus` such as `healthy`, `stale`, `partial`, `error`
- `warningSummary`
- `missingDayCount`
- `backfillInProgress`

## Overview

Required summary cards:

- estimated actual cost for selected period
- estimated no-solar cost for selected period
- estimated savings
- export value
- payback progress

Required chart series:

- none mandatory in v1; keep this screen summary-first

Required comparison metrics:

- actual net cost
- no-solar net cost
- savings amount
- export contribution

Required health/status fields:

- trust badge state
- last updated
- current warning summary

Editable entities:

- none directly on the page, but it should link to tariffs, setup, and settings

## Live

Required summary cards:

- current generation
- current consumption
- current import
- current export
- current solar coverage percentage

Required chart series:

- recent interval generation
- recent interval consumption
- recent interval import
- recent interval export

Required comparison metrics:

- self-consumption vs grid reliance right now

Required health/status fields:

- freshness timestamp
- live feed health
- provider warning state

Editable entities:

- none

## Daily History

Required summary cards:

- import total
- generation total
- export total
- consumption total
- estimated actual cost
- estimated no-solar cost
- estimated savings
- export credit

Required chart series:

- interval import
- interval generation
- interval export
- interval consumption

Required comparison metrics:

- actual vs no-solar cost
- export contribution
- solar coverage for the day

Required health/status fields:

- day completeness
- selected date trust state
- warning summary

Editable entities:

- none

## Range History

Required summary cards:

- range actual cost
- range no-solar cost
- range savings
- range export value

Required chart series:

- trend over time for savings or net cost
- trend over time for generation / import / export / consumption

Required comparison metrics:

- actual vs no-solar
- export contribution
- average solar coverage
- best/worst periods if available

Required health/status fields:

- data completeness over the range
- tariff change flag
- warning summary

Editable entities:

- none

## Tariffs Overview and History

Required summary cards:

- current tariff summary
- current reminder / review status

Required chart series:

- none required; use a timeline/list instead

Required comparison metrics:

- what tariff is active now
- which versions applied during history windows

Required health/status fields:

- expired validity state
- contract reminder state
- missing tariff detail warning

Editable entities:

- tariff plan
- tariff versions
- contract reminder metadata

Validation rules:

- validity ranges should not overlap for the same plan without explicit resolution
- tariff validity and contract end date should remain separate concepts

## Tariff Version Editor

Required summary cards:

- none

Required chart series:

- none

Required comparison metrics:

- recalculation impact summary if known

Required health/status fields:

- save state
- validation state

Editable entities:

- supplier name
- plan name
- day, night, peak, and export rates
- fixed charges
- validity start/end
- contract end date

Validation rules:

- required fields must be clear
- overlapping validity should be blocked or explicitly resolved
- retrospective edits should warn about affected reporting periods

## Data Health

Required summary cards:

- overall health
- last successful sync
- affected periods count

Required chart series:

- none required in v1

Required comparison metrics:

- current state vs expected healthy state

Required health/status fields:

- provider status
- stale / partial / missing-day indicators
- backfill state
- last error summary

Editable entities:

- reconnect provider action
- retry or backfill action if supported later

## Settings and Privacy

Required summary cards:

- provider connection summary
- account status

Required chart series:

- none

Required comparison metrics:

- none required

Required health/status fields:

- provider connected or revoked
- deletion request status

Editable entities:

- installation profile
- locale / timezone
- notification preferences
- provider reconnect flow
- account deletion request

## Backend Implications

These UI contracts imply that the next backend slices should expose:

- an overview summary shape that is explicitly comparison-first
- a live/day-detail payload that includes both energy values and trust metadata
- a range-summary payload that includes tariff-change and completeness flags
- tariff-management payloads that separate validity windows from contract reminders
- shared trust/status fields that can be rendered consistently across screens
