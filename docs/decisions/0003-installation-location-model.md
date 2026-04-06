# Decision Record 0003: Installation Location Model and Geocoding Persistence

## Status

Accepted

## Date

2026-04-03

## Context

FE-004 requires the Live screen to show weather forecast and solar-context
information. These features depend on a canonical latitude/longitude pair for
each installation. This record defines how location is captured, normalized,
persisted, and reused so that:

- Live never geocodes on a page request
- Users can choose exact or approximate location for privacy reasons
- The data model is provider-agnostic enough to survive a geocoder swap
- Missing or stale location states are handled cleanly on the Live screen

This is a design-and-requirements record. Actual Drizzle schema changes and
migrations are out of scope here and belong to a later implementation story
(P-035 or a dedicated migration story).

---

## Required Installation Fields

The following fields must be added to the `installations` table. All are
nullable because location capture is an optional onboarding step; the
installation must be usable before location is set.

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `location_raw_input` | `text` | yes | The original string the user typed (full address, postcode, eircode, zipcode, or town name). Retained to support re-geocoding if the provider changes, and to show users what produced their stored location. |
| `location_display_name` | `text` | yes | Human-readable label returned by the geocoder. In approximate mode this must be a locality or region label, never a street-level address. |
| `location_latitude` | `numeric(9,6)` | yes | Decimal degrees, WGS84. `numeric(9,6)` gives ~0.11 m resolution, which exceeds the accuracy needed for weather context. |
| `location_longitude` | `numeric(9,6)` | yes | Decimal degrees, WGS84. |
| `location_precision_mode` | `text` | yes | Product-level privacy choice: `exact` or `approximate`. Set by the user during onboarding. Never enforced by the geocoder. |
| `location_country_code` | `text` | yes | ISO 3166-1 alpha-2, if returned by the geocoder. Used to support locale-appropriate display and future geocoder selection logic. |
| `location_locality` | `text` | yes | City or town name returned by the geocoder. Used as the display label in approximate mode. |
| `location_geocoded_at` | `timestamptz` | yes | Timestamp of the most recent successful geocoding run. Used to detect stale location data. |
| `location_geocoder_provider` | `text` | yes | Slug identifying the geocoder used (e.g. `geoapify`, `open-meteo-geocoding`). Records the source for debugging and future swap auditing. |

No index is required on the location columns. Location reads happen per
installation lookup and the installation ID index already covers that path.

---

## Precision Mode Semantics

`location_precision_mode` is a **product-level privacy choice** made by the
user during onboarding. It is not a geocoder constraint. The geocoder always
attempts the most precise resolution it can given the input.

### `exact`

- The user entered and confirmed a full address (street, postcode, or eircode).
- `location_display_name` may show the full resolved address label.
- `location_latitude` and `location_longitude` reflect the geocoder's most
  precise result.
- Appropriate when the user is comfortable with exact location context.

### `approximate`

- The user entered a postcode, eircode, town name, or general area.
- `location_display_name` must be set to a locality or region label only —
  never a street-level address — regardless of what the geocoder resolved.
- `location_latitude` and `location_longitude` may still reflect a precise
  centroid if the geocoder returned one, but the UI must not imply street-level
  precision.
- Appropriate when the user prefers privacy-preserving location context.

The distinction is about what the product surfaces and stores as a label, not
about truncating the resolved coordinates. Weather and solar-context APIs
require accurate coordinates to return useful data regardless of precision mode.

---

## What Raw Input Is Retained

`location_raw_input` stores the exact string the user submitted in the location
field. It is retained for two reasons:

1. **Re-geocoding support** — if the geocoder provider changes and existing
   results need to be refreshed, the original input can be re-submitted without
   asking the user to re-enter their location.
2. **User transparency** — the settings UI can show users what input produced
   their stored location, so they can correct it if needed.

`location_raw_input` must not be logged or surfaced in operator tooling beyond
what is minimally needed for support. Installation ID is the preferred key for
log lines.

---

## Re-Geocoding Triggers

Geocoding is expensive relative to Geoapify's free-tier limit (3,000 calls/day)
and must be controlled carefully.

### When geocoding runs

1. **Onboarding** — geocoding runs once when the user confirms their location
   during the installation setup flow.
2. **User edit** — geocoding runs if the user changes their location input in
   settings and saves the change.

### When geocoding does NOT run

- On each Live page load.
- On input events or keystrokes during the location entry form.
- Automatically in the background on a schedule.

### Submission-gated geocoding

Geocoding must be gated to **confirmed form submissions**, not to input events.
Autocomplete-style requests on each keystroke would exhaust the Geoapify daily
limit. Onboarding UX (U-038) must respect this constraint.

### Atomic update on geocoding

When geocoding runs and succeeds, all location fields must be updated
atomically in a single write:

- `location_raw_input`
- `location_display_name`
- `location_latitude`
- `location_longitude`
- `location_country_code`
- `location_locality`
- `location_geocoded_at`
- `location_geocoder_provider`

A partial write (e.g. raw input updated but coordinates not yet written) must
not be visible to the Live read path.

### Stale-location background re-geocode

If `location_geocoded_at` is more than 90 days old and the installation has
been recently active, a soft background re-geocode may be triggered server-side
on the next Live page load. This:

- must not block the Live render
- must not be triggered on every page load (gate to once per day at most)
- should update all location fields atomically on success
- should be a silent no-op on failure (stale data is still usable)

The 90-day threshold is a product default. U-038 or P-035 may revise it if
onboarding defines a different freshness expectation.

---

## Missing-Location Behavior on Live

### No location set

If `location_latitude` is `null`:

- The weather forecast rail, 5-day forecast cards, and solar-context section
  of the Live screen must be hidden entirely.
- A location-setup prompt should be shown in the `Next` section instead.
- The rest of the Live screen (realtime energy, current-day data) must
  continue to function normally.

### Valid location, forecast API unavailable

If `location_latitude` is set but a forecast API call fails:

- Sun events derived from a recent cached response may still be displayed if
  available.
- The forecast rail and 5-day cards must show a `data unavailable` state rather
  than an empty slot or a crash.
- The Live screen must not show a top-level error state; the API failure is
  scoped to the weather modules only.
- The realtime energy section must not be affected.

### Geocoding failed during onboarding

If geocoding fails for an entered location string:

- The installation is still created; location fields remain `null`.
- The onboarding flow must surface the failure clearly and allow retry or skip.
- Skipping location entry leaves all location fields `null` and triggers the
  missing-location state on Live.

---

## Privacy and Labeling Rules

1. In **approximate mode**, the UI must never display a street-level address
   label. `location_display_name` must be a locality or region string. If the
   geocoder returned a more specific label, the server must substitute the
   `location_locality` value or a suitable short form before storing
   `location_display_name`.

2. `location_raw_input` must not appear in structured application logs, job
   logs, error summaries, or operator-facing dashboards. Use installation ID
   as the log key.

3. `location_latitude` and `location_longitude` are treated as user-owned
   product data and must be deleted as part of the account deletion workflow
   (consistent with the deletion model in `docs/architecture.md`).

---

## Provider-Agnostic Design

`location_geocoder_provider` records which geocoder produced the stored result.
This supports:

- Debugging when geocoded results look incorrect
- Identifying installations that used a deprecated provider after a swap
- Triggering targeted re-geocoding for a specific provider's results

Adapters (Geoapify, Open-Meteo Geocoding) must translate their raw responses
into the normalized `ResolvedLocation` shape defined in Decision 0002 before
any field is written to the installation. No provider-specific field names or
response shapes should appear in the location write path.

---

## What This Unlocks

| Story | Dependency satisfied |
|---|---|
| `U-038` | Onboarding UX can design exact/approximate capture and privacy copy without reopening data-model decisions |
| `P-035` | Server slice can read `location_latitude`, `location_longitude`, and `location_precision_mode` directly; knows geocoding is pre-done |
| `Q-013` | Validation coverage can target missing-location states, stale-geocode behavior, and approximate-label correctness |

---

## References

- [FE-004 feature overview](/docs/features/FE-004.md)
- [Decision 0002 — Weather, Location, and Sun-Context Provider Contract](/docs/decisions/0002-weather-location-provider-contract.md)
- [Decision 0001 — Runtime Boundaries and Infra Deferral](/docs/decisions/0001-runtime-boundaries-and-infra-deferral.md)
- [Architecture — Privacy and Deletion Model](/docs/architecture.md)
