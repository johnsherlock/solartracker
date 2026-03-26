# Solar Stats Calculation Specification

## Status

This document is the working source of truth for savings and bill-impact logic. It starts with what is known from the existing codebase and product intent, and it must be revised when bills, tariff documents, and sample datasets are added.

Anything uncertain should stay explicit in the remaining evidence questions until validated.

Supplier bills and manually exported supplier CSV files referenced here are development-only validation evidence. They are not intended to become runtime application inputs or a user-facing upload feature.

## Primary Financial Outputs

The product should be able to compute, for any supported period:

- actual import cost
- standing charges and other fixed charges
- export credit or export value
- estimated net bill impact
- estimated "without solar" bill for the same period
- savings attributable to solar
- savings relative to install cost or finance cost
- self-consumption and grid-dependence percentages

## Working Definitions

### Actual bill impact

The modeled electricity cost for the period using the user's real measured import, export, and tariff rules active on each date.

### No-solar baseline

A modeled counterfactual representing what the user would likely have paid if the same household demand had occurred without solar generation.

Initial intent:

- household demand still exists
- solar generation is removed as a supply source
- export disappears because unused generation would not exist
- the shortfall is assumed to come from the grid under the tariff active at the time

### Solar savings

The difference between the no-solar baseline and the actual bill impact for the same period.

### Installation payback view

A comparison between solar-attributed savings and the user's installation cost, finance cost, or target payback period.

## Inputs Required

### Meter or provider inputs

- solar/provider telemetry by interval, such as generation, export, immersion, and derived consumption
- supplier or meter import data by interval where available
- supplier billing-period totals and charges
- timestamps and timezone context

### Tariff inputs

- day rate
- peak rate
- night rate
- export rate
- VAT rate
- standing charge
- other recurring charges such as PSO or equivalent
- discount rules
- free-energy windows if applicable
- tariff version effective start and end dates

### User economic inputs

- monthly finance payment, if financed
- upfront install cost, if owned outright
- optional target payback assumptions

## Known Logic In Current Code

The current proof of concept includes logic for:

- day, peak, night, and free pricing tiers
- VAT application
- standing charge handling
- monthly PSO charge handling
- export valuation
- green-energy saving calculations
- date-range aggregation

Observed values in the current code are implementation detail only and should not be treated as validated business truth.

## Proposed Calculation Rules

These rules are the current product-direction defaults. They are intended to unblock schema and application design now, while later fixture work and bill reconstruction tests can still tighten edge cases.

### 1. Import cost

Proposed rule:

- import is priced by tariff window using the tariff version active at the local interval timestamp
- bill reconstruction should use local installation time, not UTC bucket boundaries
- discounts should be modeled as supplier-plan rules attached to the tariff version and applied before VAT unless bill evidence proves otherwise for a specific supplier
- free-energy windows, when a tariff includes them, should be modeled as zero-priced import in those intervals rather than as a separate credit line

Implication:

- the runtime product can calculate actual import cost from interval import plus tariff-version history alone
- supplier bills remain the validation source for whether a supplier applies any statement-level adjustments beyond the tariff metadata

### 2. Export treatment

Proposed rule:

- export should be modeled as a separate credit line, not as negative import
- the product should show `import cost`, `fixed charges`, `export credit`, and `net bill impact` separately
- `actual.netCost` should equal `actual.importCost + actual.fixedCharges - actual.exportCredit`
- solar `savings` should be calculated from the difference between `withoutSolar.netCost` and `actual.netCost`, so export contributes to savings through the net bill impact
- the UI should still expose export value separately so users can distinguish self-consumption value from export value

Reasoning:

- this best matches the bill semantics seen so far, where export appears as its own line/value rather than rewriting import usage
- it also aligns with the product requirement to explain export clearly rather than hiding it inside a single savings number

### 3. No-solar baseline

Proposed rule:

- the no-solar baseline should use actual household demand, not billed import, as the counterfactual load shape
- baseline demand should be derived from canonical consumption readings, which are currently modeled from MyEnergi as `import + generation - export - immersionDiverted`
- baseline import should be the demand that would have remained if solar generation were removed while household behavior stayed otherwise unchanged
- export becomes zero in the no-solar scenario
- the same tariff windows and fixed-charge rules should apply in the baseline because the household is assumed to be on the same plan in the same period

Immersion default:

- immersion-diverted energy should remain explicitly tracked as its own field in the canonical model
- for v1 baseline calculations, immersion-diverted energy should be treated as displaced electric demand and therefore part of solar-attributed value
- immersion-boosted energy should not be counted as solar savings because it is already grid-powered usage

Why this default:

- it keeps the baseline focused on "what electricity would have been imported without solar"
- it avoids using supplier import as the baseline, which would erase the very solar effect we are trying to measure
- it preserves a future escape hatch if some installations need a different treatment for diverted immersion load

### 4. Fixed charges

Proposed rule:

- standing charges, PSO, and other recurring billed charges should be modeled as date-ranged tariff-version properties or related fixed-charge versions
- fixed charges should be included in both `actual` and `withoutSolar` scenarios when they would have applied regardless of solar production
- savings should therefore usually come from reduced import cost and export credit rather than from fixed-charge changes
- period calculations should prorate fixed charges by local calendar day coverage unless supplier evidence shows a different supplier-specific rule
- statement-only credits or discounts that do not arise from interval usage should be modeled separately from interval energy pricing

Implication:

- we need fixed-charge versioning alongside unit-rate versioning, because the supplied bills already show charge changes inside broader periods

### 5. Tariff versioning

Proposed rule:

- tariff versions must be date-ranged and resolved at sub-billing-period granularity
- a calculation over any range should partition intervals by the tariff version active at each local timestamp, then aggregate the results
- fixed charges should also support dated versions rather than being assumed constant across a whole contract
- tariff metadata should include supplier name, product name, and an audit-friendly version label or identifier
- bill reconstruction should operate in two stages:
  - interval-level cost attribution by tariff version
  - statement-level aggregation for comparison against supplier bills

Implication:

- historical recalculation must remain possible when users correct tariff validity windows retrospectively

### 6. Tariff validity versus contract dates

Proposed rule:

- tariff validity windows and contract end dates must be modeled separately
- tariff validity controls which rates are used for calculation
- contract end dates are reminders and lifecycle metadata, not calculation inputs by themselves
- users must be able to correct tariff validity retrospectively and trigger recalculation for affected periods
- if a contract continues but supplier rates change, a new tariff version must be created without assuming the contract itself ended
- if a contract passes its expected renewal or review date without a newer tariff version being entered, the product should warn that the configured rates may now be stale or optimistic

Implication:

- the runtime model needs both dated tariff versions and optional contract reminder fields
- historical accuracy depends on tariff validity data, not on contract labels alone

## Proposed Domain Outputs

The savings engine should return structured outputs rather than UI-shaped values:

```ts
type BillingComparison = {
  periodStart: string;
  periodEnd: string;
  actual: {
    importCost: number;
    fixedCharges: number;
    exportCredit: number;
    grossCost: number;
    netCost: number;
  };
  withoutSolar: {
    importCost: number;
    fixedCharges: number;
    grossCost: number;
    netCost: number;
  };
  solar: {
    savings: number;
    exportValue: number;
    selfConsumptionRatio: number;
    gridDependenceRatio: number;
  };
};
```

## Evidence Sources

This document should be updated from:

- supplied energy bills
- tariff documentation or screenshots
- manually exported supplier CSV evidence
- sample MyEnergi exports
- known-good periods where expected savings are understood
- reference observations from the current app

## Evidence Inventory In Repo

Current evidence files under [`sample data/`](/Users/john/Documents/Projects/pv-manager/sample%20data):

- [Mar-Apr 25 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/Mar-Apr%2025%20billing%20period.png)
- [May-July 25 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/May-July%2025%20billing%20period.png)
- [July-Aug 25 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/July-Aug%2025%20billing%20period.png)
- [Sept-Oct 25 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/Sept-Oct%2025%20billing%20period.png)
- [Nov-Dec 25 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/Nov-Dec%2025%20billing%20period.png)
- [Jan-Feb 26 billing period.png](/Users/john/Documents/Projects/pv-manager/sample%20data/Jan-Feb%2026%20billing%20period.png)
- [02-05-25 to 03-07-25.csv](/Users/john/Documents/Projects/pv-manager/sample%20data/02-05-25%20to%2003-07-25.csv)
- [09-07-25.csv](/Users/john/Documents/Projects/pv-manager/sample%20data/09-07-25.csv)

## Observed Billing Evidence

### Tariff windows seen on supplied Energia bills

- day or smart day: all other times
- night: 11pm to 8am
- peak: 5pm to 7pm

These windows align with the current proof-of-concept assumptions and should be used as the initial validation target.

### March to May 2025 billing period

From the supplied bill:

- billing period: 2025-02-28 to 2025-05-02
- day rate: `0.3451`
- night rate: `0.1848`
- peak rate: `0.3617`
- standing charge: `0.59` per day
- PSO levy: `3.23` per month
- export credit: `0.20` per unit

### May to July 2025 billing period

From the supplied bill:

- billing period: 2025-05-02 to 2025-07-03
- day rate: `0.3451`
- night rate: `0.1848`
- peak rate: `0.3617`
- standing charge: `0.59` per day
- PSO levy: `3.23` per month
- export credit: `0.20` per unit

The supplier export [02-05-25 to 03-07-25.csv](/Users/john/Documents/Projects/pv-manager/sample%20data/02-05-25%20to%2003-07-25.csv) appears to represent half-hourly Energia-side usage across this same bill window:

- `63` daily rows
- `48` half-hour intervals per day
- first date: `2025-05-02`
- last date: `2025-07-03`

Initial bucketing of this CSV using the bill's day/night/peak windows approximately reproduces the billed usage totals, but not perfectly. That strongly suggests we need to validate one or more of:

- inclusive vs exclusive billing-period boundaries
- supplier-specific treatment of boundary dates
- daylight-saving or clock-change handling
- meter reconciliation or rounding behavior

This is useful because it gives us a concrete fixture for bill-reconstruction tests and for internal reconciliation against MyEnergi-derived household usage during development.

### Initial supplier-versus-MyEnergi comparison

Using the live minute-data API and filtering on the local date fields returned by the payload:

- requested `2025-05-07`
  - MyEnergi-derived import: about `5.0116 kWh`
  - supplier CSV total for `2025-05-07`: `5.3490 kWh`
- requested `2025-07-09`
  - MyEnergi-derived import: about `5.3079 kWh`
  - supplier CSV total for `2025-07-09`: `5.6525 kWh`

Tariff-bucket comparison for `2025-07-09` is also directionally close:

- supplier CSV
  - day: `1.2310`
  - night: `3.2385`
  - peak: `1.1830`
- MyEnergi-derived import
  - day: `1.2536`
  - night: `2.8642`
  - peak: `1.1901`

Interpretation:

- the supplier CSV is likely much closer to billed grid import than to total household consumption
- MyEnergi minute `imp` data appears directionally comparable and therefore useful for reconciliation
- the remaining mismatch is likely due to boundary handling, supplier reconciliation, or clock/tariff bucketing differences rather than the two sources measuring entirely different concepts

### Supplier CSV half-hour label interpretation

For `2025-05-07`, comparing the supplier CSV row against MyEnergi minute `imp` data strongly suggests that each supplier half-hour column labels the interval that starts at that timestamp rather than the interval that ends there.

Observed result:

- interpreting `12:00` as `12:00-12:29` matches the MyEnergi-derived import closely
- interpreting `12:00` as `11:30-11:59` does not match
- across the full `2025-05-07` day, the leading-interval interpretation is much closer than the trailing-interval interpretation

Example comparisons:

- `08:00` CSV `0.0130`, API leading-window `0.0134`, API trailing-window `0.7103`
- `12:00` CSV `0.1015`, API leading-window `0.1017`, API trailing-window `0.0220`
- `15:30` CSV `0.0590`, API leading-window `0.0586`, API trailing-window `0.0808`

Current working interpretation:

- a supplier CSV row for a given date covers local time from `00:00` through `23:59` on that displayed date
- a half-hour column such as `12:00` should be interpreted as the interval beginning at `12:00`, not ending there

This should remain the default interpretation unless future DST-edge evidence proves a different supplier convention during clock changes.

### Strong alignment example: 2025-11-01

For `2025-11-01`, the supplier CSV and the MyEnergi-derived import align very closely:

- supplier CSV total: `14.0040 kWh`
- MyEnergi-derived import total: `13.9277 kWh`

Tariff buckets also align closely:

- supplier CSV
  - day: `7.3345`
  - night: `3.5955`
  - peak: `3.0740`
- MyEnergi-derived import
  - day: `7.3011`
  - night: `3.5713`
  - peak: `3.0554`

This is currently the clearest evidence that:

- the timezone-adjusted API can be normalized correctly by filtering on returned local date fields
- MyEnergi `imp` is a strong comparison source for supplier-side import data
- earlier summer mismatches are likely dominated by boundary or DST effects rather than a bad mapping model

## Source-of-Truth Distinction

Two materially different data sources are now in scope and must stay distinct in the model:

### 1. Supplier-side billing and import evidence

Examples:

- Energia bills
- Energia CSV interval exports

Primary uses:

- reconstruct billed import, fixed charges, VAT, discounts, and export credit treatment
- validate tariff windows and tariff-version transitions
- provide the closest available reference to what the user was actually charged
- provide a comparison target for MyEnergi-derived import totals

Important boundary:

- this evidence is for development-time validation and calibration
- it is not a planned end-user ingestion path for the product
- users should not need to upload supplier CSVs for the app to work

### 2. MyEnergi solar-side telemetry

Examples:

- raw MyEnergi API payloads
- normalized solar interval readings derived from the MyEnergi API

Primary uses:

- generation, export, immersion, and solar-behavior views
- household energy modeling
- no-solar baseline and savings analysis
- comparison and reconciliation against supplier-side billed import during internal validation

These sources should not be treated as interchangeable, even if they cover overlapping periods.

Implication for the model:

- supplier data is the best evidence for billed import and statement reconstruction
- MyEnergi data is the best evidence for solar behavior and internal energy-flow modeling
- development tooling should support comparing and reconciling the two where periods overlap
- supplier-side import should be treated as the stronger source for billed import validation when available

### July to August 2025 billing period

From the supplied bill:

- billing period: 2025-07-03 to 2025-08-29
- day rate: `0.3451`
- night rate: `0.1848`
- peak rate: `0.3617`
- standing charge: `0.59` per day
- PSO levy: `3.23` per month
- export credit: `0.20` per unit

### September to October 2025 billing period

This bill clearly demonstrates a rate change inside one billing period.

Observed split:

- standing charge split across `40` days at `0.59` and `22` days at `0.66`
- day units split across `0.3451` and `0.3865`
- night units split across `0.1848` and `0.2125`
- peak units split across `0.3617` and `0.434`
- export units split across `0.20` and `0.185`

This is the strongest current evidence that tariff versioning must work at sub-billing-period granularity.

### November to January billing period

From the supplied bill:

- billing period: 2025-10-30 to 2026-01-02
- day rate: `0.3865`
- night rate: `0.2125`
- peak rate: `0.434`
- standing charge: `0.66` per day
- export credit: `0.185` per unit

The bill also shows Public Service Obligation levy values changing within the broader period, which means fixed-charge modeling may also need date-ranged versions, not just unit-rate versions.

### January to February 2026 billing period

The supplied bill for 2026-01-02 to 2026-02-27 is split into subperiods because the user renewed their contract on `2026-01-09`, so new rates applied after that date.

Implication:

- tariff versions must support effective-date changes inside a billing period
- contract renewal can trigger a new tariff version, but the calculation model should still resolve rates from tariff validity periods rather than from a contract label alone

## Resolved Product Defaults

- The product should expose one primary `total savings` metric, while still showing export value as a separate line item. A narrower `self-consumption savings` metric can be deferred unless user testing proves it is necessary.
- Installation payback should be shown first as a simple comparison against install or finance cost for the chosen period. Rolling cumulative ROI/payback can remain a later enhancement rather than a Phase 2 dependency.
- Incomplete days or partial intervals should be flagged explicitly. They may still appear in operational views, but they should be excluded from validated bill-comparison outputs unless the user deliberately includes them with a warning.
- Billing-period reconstruction should explicitly model interval usage charges, export credit, VAT, standing charges, PSO, and tariff-version splits. One-off goodwill credits, arrears, or non-energy corrections should stay outside the core savings model unless they recur and can be represented cleanly.
- Internal validation should support both statement-line comparison and daily reconstructed views. Statement-level totals are the acceptance target, while daily views are for debugging and reconciliation.
- When supplier CSV boundaries disagree with bill totals, the supplier bill should win as the authoritative validation target. CSV intervals should be treated as supporting evidence used to diagnose boundary, DST, or rounding issues rather than as the final truth.
- Internal reconciliation reports should show totals and variance for the whole period plus day/night/peak buckets, including both absolute kWh difference and percentage difference, with a short classification such as `aligned`, `close`, or `investigate`.

## Remaining Open Evidence Questions

- What exact boundary convention does the supplier CSV use when its interval totals differ slightly from statement totals?

## Next Inputs Needed

- tariff documentation for the supplied periods, if available
- confirmation from supplier documentation of what the CSV represents exactly, even though initial comparisons suggest it is close to billed import
- example dates where the current app looks right
- example dates where the current app looks wrong or suspicious
- MyEnergi credentials only when we are ready to validate solar-side telemetry against supplier-side billed or interval data
