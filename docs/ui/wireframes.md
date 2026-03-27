# Solar Stats Low-Fi Wireframes

These wireframes are intentionally low fidelity. They focus on layout, hierarchy,
navigation, and trust cues rather than polish.

## 1. Landing Page

### Desktop

```text
+----------------------------------------------------------------------------------+
| NAV: Logo | How it works | Supported setups | Beta access                        |
+----------------------------------------------------------------------------------+
| HERO                                                                          CTA |
| "Understand whether solar is really cutting your bill."                  Request |
| Short explanation of savings, tariffs, export value, and payback.        access  |
+--------------------------------------+-------------------------------------------+
| WHY THIS EXISTS                      | WHAT YOU CAN SEE                           |
| - Bill impact                        | - Live import / export / generation        |
| - No-solar comparison                | - Daily and range history                  |
| - Tariff-aware history               | - Tariff-aware savings and payback         |
+--------------------------------------+-------------------------------------------+
| SUPPORTED SETUP / TRUST / PRIVACY STRIP                                         |
+----------------------------------------------------------------------------------+
| BETA ACCESS CTA                                                                  |
+----------------------------------------------------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Logo                       Menu  |
+----------------------------------+
| Hero headline                    |
| Hero copy                        |
| [Request beta access]            |
+----------------------------------+
| Why this exists                  |
+----------------------------------+
| What you can see                 |
+----------------------------------+
| Supported setup / privacy        |
+----------------------------------+
```

## 2. Overview

### Desktop

```text
+----------------------------------------------------------------------------------+
| HEADER: Date range / trust badge / last updated                                  |
+----------------------------------------------------------------------------------+
| SETUP PROGRESS: 2 of 5 complete | Live unlocked | Add tariff to unlock savings   |
+----------------------------------------------------------------------------------+
| BILL IMPACT          | NO-SOLAR COST       | EXPORT VALUE       | PAYBACK        |
+----------------------+---------------------+--------------------+----------------+
| PRIMARY INSIGHT / EXPLAINER PANEL                                                 |
+------------------------------------------+---------------------------------------+
| LIVE SNAPSHOT                             | DATA HEALTH                           |
| - current import/export/generation        | - last sync                           |
| - current solar coverage                  | - warnings / missing days             |
+------------------------------------------+---------------------------------------+
| SHORTCUTS: View live | Review yesterday | Open month view | Review tariffs       |
+----------------------------------------------------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Date range / trust badge         |
+----------------------------------+
| Setup progress / unlock-more     |
+----------------------------------+
| Live snapshot                    |
+----------------------------------+
| Bill impact card                 |
+----------------------------------+
| No-solar comparison card         |
+----------------------------------+
| Export value card                |
+----------------------------------+
| Payback progress card            |
+----------------------------------+
| Explainer panel                  |
+----------------------------------+
| Data health                      |
+----------------------------------+
```

## 3. Live View

### Desktop

```text
+----------------------------------------------------------------------------------+
| HEADER: Live | Freshness timestamp | Status badge                                 |
+----------------------------------------------------------------------------------+
| GEN NOW           | USE NOW           | IMPORT NOW        | EXPORT NOW             |
+-------------------+-------------------+-------------------+------------------------+
| SOLAR COVERAGE / GRID RELIANCE BAR                                              |
+----------------------------------------------------------------------------------+
| LINE GRAPH OF SOLAR COVERAGE BY MIN/HALF_HOUR/HOUR                               |
+----------------------------------------------------------------------------------+
| PIE CHART OF ENERGY COST/SAVINGS - OFF PEAK IMPORT/DAY IMPORT/PEAK IMPORT/SOLAR OFF PEAK/SOLAR DAY/SOLAR PEAK |
+----------------------------------------------------------------------------------+
| RECENT INTERVAL TREND                                                           |
+------------------------------------------+---------------------------------------+
| CURRENT-DAY TOTALS                        | WARNINGS / SOURCE NOTES               |
+------------------------------------------+---------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Live / freshness / status        |
+----------------------------------+
| Now metrics grid                 |
+----------------------------------+
| Coverage bar                     |
+----------------------------------+
| LINE GRAPH OF SOLAR COVERAGE BY MIN/HALF_HOUR/HOUR                               |
+----------------------------------------------------------------------------------+
| PIE CHART OF ENERGY COST/SAVINGS - OFF PEAK IMPORT/REUGLAR IMPORT/PEAK IMPORT/SOLAR OFF PEAK/SOLAR REGULAR/SOLAR PEAK |
+----------------------------------+
| Recent trend chart               |
+----------------------------------+
| Current-day totals               |
+----------------------------------+
| Warnings / source notes          |
+----------------------------------+
```

## 4. Daily History View

### Desktop

```text
+----------------------------------------------------------------------------------+
| HEADER: Selected date | Prev / Next | trust badge                                 |
+----------------------------------------------------------------------------------+
| IMPORT           | GENERATION       | EXPORT            | CONSUMPTION            |
+------------------+------------------+-------------------+------------------------+
| SAVINGS TODAY     | NO-SOLAR COST    | ACTUAL COST       | EXPORT CREDIT          |
+----------------------------------------------------------------------------------+
| MAIN DAY CHART: import / export / generation / consumption                       |
+------------------------------------------+---------------------------------------+
| DAY STORY / HIGHLIGHTS                    | WARNINGS / NOTES                      |
+----------------------------------------------------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Date / nav / trust badge         |
+----------------------------------+
| Totals cards                     |
+----------------------------------+
| Bill impact cards                |
+----------------------------------+
| Day chart                        |
+----------------------------------+
| Highlights / warnings            |
+----------------------------------+
```

## 5. Range History View

### Desktop

```text
+----------------------------------------------------------------------------------+
| HEADER: preset tabs + custom range + trust badge                                 |
+----------------------------------------------------------------------------------+
| SAVINGS           | ACTUAL COST       | NO-SOLAR COST     | EXPORT VALUE          |
+-------------------+-------------------+-------------------+-----------------------+
| RANGE EXPLAINER / KEY TAKEAWAY                                                   |
+----------------------------------------------------------------------------------+
| TREND CHART                                                                     |
+------------------------------------------+---------------------------------------+
| BREAKDOWN BY DAY/WEEK/MONTH               | PERIOD FLAGS                         |
|                                           | - tariff changed                     |
|                                           | - missing data                       |
+----------------------------------------------------------------------------------+
```

### Mobile

```text
+----------------------------------+
| Preset tabs / custom range       |
+----------------------------------+
| KPI cards                        |
+----------------------------------+
| Key takeaway                     |
+----------------------------------+
| Trend chart                      |
+----------------------------------+
| Breakdown                        |
+----------------------------------+
| Flags / warnings                 |
+----------------------------------+
```

## 6. Onboarding Flow

### Flow

```text
Welcome -> Provider connection (required) -> Installation setup (optional) ->
Tariff setup (optional) -> Finance/payback inputs (optional) -> Review -> Overview
```

Progress rules:

- Provider connection is the only required step.
- All other setup steps can be skipped and completed later.
- Overview should show a setup-progress card such as "1 of 4 recommended setup steps completed".
- If tariff details are missing, savings cards should be replaced with a prompt to finish tariff setup.

### Installation Setup

```text
+----------------------------------+
| Optional step                    |
+----------------------------------+
| Installation name                |
| Approximate installation date    |
| Theoretical max array output     |
| Timezone                         |
| Locale / currency                |
| [Save and continue] [Skip for now] |
+----------------------------------+
```

Notes:

- Installation date may be approximate.
- If installation date is unknown, backfill can start from a best-effort discovered boundary.
- Theoretical max array output enables efficiency indicators later.

### Provider Connection

```text
+----------------------------------+
| Required step                    |
+----------------------------------+
| Provider type                    |
| Credential inputs                |
| [Test connection]                |
| Result / guidance                |
| [Continue]                       |
+----------------------------------+
```

### Tariff Setup

```text
+----------------------------------+
| Optional step                    |
+----------------------------------+
| Supplier / plan                  |
| Day / night / peak / export      |
| Valid from / valid to            |
| Contract end date                |
| If skipped: savings cards stay locked |
| [Save and continue] [Skip for now] |
+----------------------------------+
```

### Finance / Payback

```text
+----------------------------------+
| Optional step                    |
+----------------------------------+
| Finance mode                     |
| Install cost or monthly payment  |
| Finance term                     |
| Short explanation of payback     |
| [Save and continue] [Skip for now] |
+----------------------------------+
```

### Review / initial product entry

```text
+----------------------------------+
| Setup complete enough to start   |
+----------------------------------+
| Required: provider connected     |
| Completed optional steps: 1 of 4 |
| Available now: live views        |
| Locked until tariff setup:       |
| - savings cards                  |
| - no-solar comparisons           |
| Locked until finance setup:      |
| - payback reporting              |
| [Go to Overview]                 |
+----------------------------------+
```

## 7. Tariff and Contract Management

### Tariffs Overview

```text
+----------------------------------------------------------------------------------+
| CURRENT TARIFF SUMMARY | review status | reminder badge                           |
+----------------------------------------------------------------------------------+
| VERSION TIMELINE                                                                   |
+------------------------------------------+---------------------------------------+
| CONTRACT DETAILS                          | ACTIONS                               |
| - contract end                            | - add version                         |
| - tariff validity                         | - edit current                        |
| - reminder status                         | - review expired rates                |
+----------------------------------------------------------------------------------+
```

### Tariff Version Editor

```text
+----------------------------------+
| Supplier / plan                  |
| Rates                            |
| Export settings                  |
| Fixed charges                    |
| Validity window                  |
| Contract dates                   |
| Recalculation impact message     |
| [Save]                           |
+----------------------------------+
```

## 8. Data Health

### Desktop / mobile structure

```text
+----------------------------------+
| Overall health status            |
+----------------------------------+
| Last successful sync             |
| Current provider state           |
| Missing / partial days           |
| Backfill window / discovery note |
| Backfill / retry progress        |
| Actions / support guidance       |
+----------------------------------+
```

## Design Notes

- Overview should be the main signed-in landing page because it answers the core financial question fastest.
- Live, Daily, and Range views should feel related, but not identical; each needs a different primary question.
- Every wireframe should include an explicit trust surface: badge, timestamp, warning band, or health card.
- Every major view should also be able to render an intentional "setup incomplete" card rather than silently showing wrong or misleading financial information.
- Mobile layouts should stack summaries ahead of charts so users do not have to pan to find the main answer.
- Date selection should use explicit presets plus custom range, not a single overloaded picker.
- Onboarding should allow users to skip optional steps and add those details later.
