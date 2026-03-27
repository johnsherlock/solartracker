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
| Live snapshot                    |
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
Welcome -> Installation setup -> Provider connection -> Tariff setup ->
Finance/payback inputs -> Review -> Overview
```

### Installation Setup

```text
+----------------------------------+
| Step 1 of 5                      |
+----------------------------------+
| Installation name                |
| Timezone                         |
| Locale / currency                |
| [Continue]                       |
+----------------------------------+
```

### Provider Connection

```text
+----------------------------------+
| Step 2 of 5                      |
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
| Step 3 of 5                      |
+----------------------------------+
| Supplier / plan                  |
| Day / night / peak / export      |
| Valid from / valid to            |
| Contract end date                |
| [Continue]                       |
+----------------------------------+
```

### Finance / Payback

```text
+----------------------------------+
| Step 4 of 5                      |
+----------------------------------+
| Finance mode                     |
| Install cost or monthly payment  |
| Finance term                     |
| Short explanation of payback     |
| [Continue]                       |
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
| Backfill / retry progress        |
| Actions / support guidance       |
+----------------------------------+
```

## Design Notes

- Overview should be the main signed-in landing page because it answers the core financial question fastest.
- Live, Daily, and Range views should feel related, but not identical; each needs a different primary question.
- Every wireframe should include an explicit trust surface: badge, timestamp, warning band, or health card.
- Mobile layouts should stack summaries ahead of charts so users do not have to pan to find the main answer.
- Date selection should use explicit presets plus custom range, not a single overloaded picker.
