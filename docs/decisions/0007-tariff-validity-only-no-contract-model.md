# Decision Record 0007: Tariff Validity Only, No Contract Model

## Status

Accepted

## Date

2026-04-25

## Context

The roadmap and UI docs still contain older language about supplier
"contracts", contract end dates, and contract reminders alongside tariff
validity dates.

That older framing keeps resurfacing in planning conversations, even though the
current product direction is narrower:

- the app needs to know when tariff data is valid for calculation purposes
- the app may need to remind users that their tariff setup is stale or needs
  review
- the app does not need a separate supplier-contract model in order to deliver
  its core tariff-aware product value

Keeping both concepts alive in active planning creates unnecessary confusion
about what data must be captured, what affects recalculation, and what should
appear in Settings.

## Decision

The active product model will treat tariff validity as the only time-based
tariff concept that matters for user-managed setup and calculation behaviour.

### Decided now

1. Tariff validity dates are the source of truth for calculation coverage.
   - The product should continue to use tariff version date ranges to decide
     which rates apply to which days.
   - Missing or expired tariff validity is a product-trust problem because it
     can make savings and cost outputs wrong or stale.

2. The app will not maintain a separate supplier-contract concept in the active
   setup model.
   - No distinct contract entity is required for the next-wave Settings work.
   - No contract end date or mid-contract review date is required in order to
     manage tariffs correctly.

3. Reminder behaviour should be framed around tariff validity, not contract
   lifecycle.
   - If the app reminds a user to review or update something in tariff setup,
     that reminder should be anchored to tariff validity or missing successor
     tariff data.
   - Reminder preferences in future Settings work should therefore be described
     as tariff reminders rather than contract reminders.

4. Older documents that mention contract reminders should be treated as
   historical wording unless they are explicitly updated.
   - Where those docs conflict with this decision, this decision wins.
   - Cleanup of legacy wording can happen incrementally rather than blocking
     feature planning.

## Consequences

### Product consequences

- Users have fewer confusing date concepts to manage in Settings.
- Tariff maintenance remains focused on the thing that directly affects numbers
  in the app: whether a tariff version is valid for the relevant dates.
- Reminder UX can stay simpler and more actionable.

### Data-model consequences

- Future settings work does not need a separate contract table or contract date
  fields for the core tariff-management path.
- Tariff reminders can be derived from tariff-version validity state and the
  absence of newer coverage where appropriate.

### Planning consequences

- `FE-014` should use tariff-reminder language, not contract-reminder language.
- Outage/anomaly alerting remains separate from tariff reminders and belongs in
  `FE-002`.
- Legacy backlog or UI wording that still mentions contracts should be treated
  as stale language to be cleaned up over time.

## Explicitly Deferred

1. Whether a later commercial or supplier-switching feature ever needs a
   supplier-contract concept for reasons outside tariff calculations
2. The full cleanup pass across every historical doc that still uses the older
   terminology

## Relationship To Other Decisions

- This decision narrows and supersedes the older "tariff validity versus
  contract dates" framing captured in backlog item `F-009`.
- It aligns with `FE-014` by keeping reminder preferences focused on tariff
  validity and leaving outage/anomaly notifications to `FE-002`.
