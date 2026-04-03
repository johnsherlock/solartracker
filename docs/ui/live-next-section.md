# Live Screen — `Next` Section UX Spec

## Purpose

This document specifies the UX design for:

1. **Onboarding location capture** — how users enter and confirm their
   installation location, including exact and approximate modes
2. **Live screen `Next` section** — the content model, module hierarchy, and
   state behavior for the lower section of the Live screen that shows daylight,
   sun-context, and weather forecast information

This is the design specification for U-038. It is the source of truth for
P-035 (server slice) and U-039 (Live module build).

---

## Onboarding Location Capture

### Where location is captured

Location is collected as a **named step in the installation setup flow**, after
the provider connection step. It is optional — users can skip and add it later
via Settings.

The step also appears as an inline prompt in the `Next` section of the Live
screen if location has not been set.

### Form design

A single text input accepts any of the following:

- Full street address (e.g. `14 Main Street, Cork`)
- Eircode or postcode (e.g. `T12 XY34`, `BT1 1AA`)
- Town or city name (e.g. `Galway`)
- General area (e.g. `West Cork`)

**Helper copy below the input field:**

> Enter your address, eircode, postcode, or town. You can be as precise or as
> general as you like.

**No per-keystroke geocoding.** Geocoding runs only when the user presses the
confirm button (or equivalent submit action). This keeps API usage within
Geoapify's free-tier limit.

### Precision mode selection

Below the text input, a two-option control lets the user choose their precision
preference before submitting:

**Option A — Exact location**
> Use my exact location

Subtext: *Your resolved address will be used for daylight and forecast context.*

**Option B — Approximate area**
> Use an approximate area instead

Subtext: *Only your town or region will appear in the product. Your entry is kept to support future location updates, but no address detail is ever displayed.*

**Default:** Exact location is pre-selected. The user can switch to approximate
before submitting.

Precision mode is a product-level privacy choice. The geocoder always resolves
as precisely as the input allows; the precision mode controls what the product
stores as a label and how it is presented in the UI.

### Geocoding outcomes

**Success:**

- The resolved display name is shown below the form for the user to review
- In exact mode: full resolved label (e.g. `14 Main Street, Cork, Ireland`)
- In approximate mode: locality or region label only (e.g. `Cork, Ireland`)
- A short confirmation line reads: *"This is the location we'll use for daylight and forecast information."*
- A `Save location` button confirms and writes the result
- An `Edit` link returns to the input if the resolved result is wrong

**Geocoding failure:**

- The form shows an inline error: *"We couldn't find that location. Try a
  different address, postcode, or town name."*
- The input remains editable for retry
- A `Skip for now` link is available: users can continue without setting a
  location

**Skip:**

- Location fields remain unset on the installation
- The Live screen shows the missing-location prompt in the `Next` section
- The skip link label is: *"Skip for now — you can add this later in Settings"*

### Privacy copy (exact mode)

Shown as helper text after the precision mode selection when exact is active:

> Your location helps us show accurate sunrise, sunset, and forecast
> information. It is stored on your installation and used only for this
> purpose.

### Privacy copy (approximate mode)

Shown as helper text after the precision mode selection when approximate is
active:

> We'll show only your town or region in the product. Your entry is kept to
> support future location updates, but no address detail is ever displayed.

### What users see if location is never set

The `Next` section of the Live screen shows a calm prompt card (see
[Missing-location state](#no-location-set) below). The rest of the Live screen
is unaffected.

---

## Live Screen — `Next` Section

### Section label

The section is labelled **`Next`**, consistent with the three-layer Live
hierarchy from U-031 (`Now` / `Today so far` / `Next`).

### Module order

Both desktop and mobile follow this top-to-bottom order within the section:

1. **Sun events strip** — sunrise, solar noon, sunset, daylight remaining
2. **Sun position indicator** — current elevation angle and above/below horizon
3. **12-hour forecast rail** — horizontally scrollable hourly strip
4. **5-day forecast cards** — compact daily summary strip

### Desktop layout

- Sun events strip and sun position indicator sit in the left column
- 5-day forecast cards sit in the right column
- 12-hour forecast rail spans full width below both columns
- The `Next` section sits below the existing Live content (metrics, chart,
  current-day totals) without compressing it

### Mobile layout

Modules stack vertically in the order listed above. The 12-hour forecast rail
is horizontally scrollable. The 5-day forecast cards are a compact horizontal
strip; if space is tight at narrow widths, they scroll horizontally rather than
wrapping.

---

## Sun Events Strip

**Purpose:** Show the day's key solar timestamps and remaining daylight at a
glance.

**Content:**

| Field | Format | Notes |
|---|---|---|
| Sunrise | Local time, e.g. `6:42 am` | From `SunEvents.sunriseUtc`, converted to installation timezone |
| Solar noon | Local time, e.g. `1:14 pm` | Midpoint of sunrise and sunset (see Decision 0002) |
| Sunset | Local time, e.g. `7:47 pm` | From `SunEvents.sunsetUtc`, converted to installation timezone |
| Daylight remaining | Duration, e.g. `4h 23m` | From `SunPosition.daylightRemainingSeconds`; shows `0` after sunset |

**After-sunset behavior:** All four fields remain visible after sunset. Daylight
remaining reads `0` or `Sunset passed`. Solar noon and sunset show as elapsed
times in a visually muted style.

**Copy note:** Solar noon is labeled `Solar noon`, not `Peak generation` — the
product makes no claim about array output from sky position alone.

---

## Sun Position Indicator

**Purpose:** Give a quick sense of where the sun currently is in the sky.

**Content:**

| Field | Example | Notes |
|---|---|---|
| Elevation | `38°` | From `SunPosition.elevationDegrees` |
| Above/below horizon | `Above horizon` / `Below horizon` | From `SunPosition.isAboveHorizon` |

**Presentation:** A compact two-line or badge-style display. No azimuth
compass is required in this version — elevation and above/below status are
sufficient for the Live context aid goal.

**After-sunset:** Elevation shows a negative value (e.g. `-12°`) and the label
reads `Below horizon`. No error state is needed; this is correct data.

**No roof-relative claims.** The indicator must not suggest how the sun
position relates to the user's panels, roof orientation, or shading. It is
sky-relative context only.

---

## 12-Hour Forecast Rail

**Purpose:** Show upcoming weather conditions for the next 12 hours to help
users interpret near-term solar opportunity.

**Data source:** `HourlyForecast.slots` — exactly 12 entries, one per hour,
starting from the start of the current UTC hour (see Decision 0002).

### Slot content

Each slot displays:

| Field | Format | Notes |
|---|---|---|
| Time | Local hour, e.g. `3 pm` | Converted from `hourUtc` to installation timezone |
| Weather icon | WMO-code-derived icon | Day/night variant driven by `isDay` |
| Temperature | Integer °C, e.g. `14°` | From `temperatureCelsius` |
| Precipitation | Dot or mm label if > 0 | From `precipitationMm`; hidden when 0 |

Cloud cover (`cloudCoverPercent`) is used to select the weather icon variant
but is not shown as a separate number in the slot. It may be shown on hover or
as an icon fill level if the implementation team finds a clean way to do so.

### Scroll behavior

- Desktop: all 12 slots visible in a single scrollable row; if viewport is
  wide enough, no scrolling is needed
- Mobile: horizontally scrollable; at least 4–5 slots visible without scrolling

### Visual treatment of after-sunset slots

Slots that fall after today's sunset time are displayed in a visually muted
style (reduced opacity or subdued color). They are still present and
informative — users may want to plan for tomorrow morning.

### States

| State | Behavior |
|---|---|
| Loading | Skeleton slot strip (12 placeholder slots) |
| Data available | Full slot content as above |
| API unavailable | Strip reads: *"Forecast unavailable — try again later"* — no empty slots, no crash |

---

## 5-Day Forecast Cards

**Purpose:** Show the upcoming 5 calendar days at a glance for planning
context.

**Data source:** `DailyForecast.days` — exactly 5 entries, starting from today
in the installation's local timezone (see Decision 0002).

### Card content

Each card displays:

| Field | Format | Notes |
|---|---|---|
| Day label | `Today`, `Tomorrow`, weekday name | First card is always `Today` |
| Weather icon | WMO-code-derived icon | Day variant only (no night variant for daily cards) |
| High temperature | Integer °C, e.g. `17°` | From `temperatureMaxCelsius` |
| Low temperature | Integer °C, e.g. `9°` | From `temperatureMinCelsius` |
| Precipitation | mm if > 0, or rain icon | From `precipitationSumMm` |

Sunrise and sunset from `DailyForecastCard` are available to the server slice
but are not surfaced directly on these cards — they are already covered by the
sun events strip for today, and for future days they are secondary information.

### Layout

- Desktop: 5 cards in a non-scrolling horizontal row
- Mobile: horizontally scrollable compact strip; cards are narrower than desktop
  equivalents

### States

| State | Behavior |
|---|---|
| Loading | 5 skeleton cards |
| Data available | Full card content as above |
| API unavailable | Shared with forecast rail: *"Forecast unavailable — try again later"* |

---

## Location Label

A small label appears beneath the `Next` section heading to indicate what
location is being used.

**Exact mode:**

> Based on your location — *[display name]*

e.g. *Based on your location — Cork, Ireland*

**Approximate mode:**

> Based on approximate location — *[locality]*

e.g. *Based on approximate location — Cork*

The label uses subdued secondary typography. It is not a warning — it is a calm
contextual note. No alarming or privacy-warning tone is used.

---

## State Summary

### No location set

The entire `Next` section is replaced by a single prompt card:

> **Add your location for daylight and forecast context**
>
> See sunrise, sunset, and the next few hours of weather — helpful for
> understanding when solar generation is likely.
>
> [Add location →]

The CTA routes to the location setup step in Settings. The rest of the Live
screen (metrics, chart, current-day totals) is unaffected.

### Exact location, data available

All four modules render: sun events strip, sun position, 12-hour rail, 5-day
cards. Location label shows full display name.

### Approximate location, data available

Same as above. Location label shows locality only. No street-level detail
appears anywhere in the section.

### API unavailable (forecast fetch failed)

- Sun events strip: shown if a cached result for today's date is available;
  otherwise hidden silently (not replaced with an error)
- Sun position: always computed server-side; shown regardless of forecast API
  status
- 12-hour rail: shows *"Forecast unavailable — try again later"*
- 5-day cards: shows *"Forecast unavailable — try again later"*
- No top-level Live error state; the failure is scoped to the weather modules

### After sunset

- Sun events strip: shows elapsed times in muted style; daylight remaining = 0
- Sun position: elevation is negative; label reads `Below horizon`
- 12-hour rail: after-sunset slots are visually muted but present
- 5-day cards: unaffected — daily cards are not time-of-day-sensitive

### Loading

All modules show skeleton placeholders. The section height is reserved so the
page does not reflow when data arrives.

---

## What This Spec Unlocks

| Story | Dependency satisfied |
|---|---|
| `P-035` | Server slice knows the content contract for each module and which fields drive which display decisions |
| `U-039` | Module build has precise slot content, card content, state behavior, and copy without reopening design decisions |
| `Q-013` | Validation coverage can target after-sunset behavior, approximate-label correctness, API-unavailable states, and loading skeletons |

---

## References

- [FE-004 feature overview](/docs/features/FE-004.md)
- [Decision 0002 — Weather, Location, and Sun-Context Provider Contract](/docs/decisions/0002-weather-location-provider-contract.md)
- [Decision 0003 — Installation Location Model and Geocoding Persistence](/docs/decisions/0003-installation-location-model.md)
- [U-031 — Live screen three-layer hierarchy](/docs/stories/complete/U-031.md)
- [Mid-fi layout spec — Live section](/docs/ui/mid-fi-layouts.md)
