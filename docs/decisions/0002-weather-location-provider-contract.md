# Decision Record 0002: Weather, Location, and Sun-Context Provider Contract

## Status

Accepted

## Date

2026-04-03

## Context

FE-004 extends the Live screen with a 12-hour forecast rail, a 5-day forecast
summary, and sun-context information including sunrise, sunset, solar noon,
daylight remaining, and current sun position. This requires three distinct
external data capabilities:

- **Geocoding** — converting a user-entered location string into a canonical
  latitude/longitude pair
- **Forecast** — hourly and daily weather data for the next 12 hours and 5 days
- **Sun events** — sunrise, sunset, and solar noon times, plus current sun
  position (azimuth and elevation angle)

The feature must stay within zero-cost API options for initial delivery. This
record documents which providers are chosen, why certain options are excluded,
the normalized payload contract the product code will use, caching expectations,
and the constraints later implementation stories must respect.

---

## Excluded Providers

### Google Maps

Google Maps Platform has no sustained zero-cost tier for geocoding at product
scale. The free monthly credit is consumed by moderate usage and billing must be
enabled unconditionally. Google Maps is therefore out of scope for the initial
FE-004 delivery.

This does not prevent a future paid-tier integration if the product grows and
cost can be justified.

### Public Nominatim (nominatim.openstreetmap.org)

The OpenStreetMap Foundation's [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
explicitly prohibits:

- heavy bulk geocoding
- use as the primary geocoding provider in a product
- any usage that sends more than one request per second

These restrictions make the public instance unsuitable as a runtime product
dependency. The policy is designed for occasional lookups by individual users,
not application-level geocoding on behalf of many accounts.

A self-hosted Nominatim instance would not have these restrictions, but adds
operational overhead that is not warranted for the initial delivery.

---

## Chosen Provider Stack

### Preferred stack

| Capability | Provider | Notes |
|---|---|---|
| Geocoding | **Geoapify** (free tier) | 3,000 req/day free; no billing required; good European/Irish address quality |
| Hourly forecast | **Open-Meteo** | Completely free, no API key; 10,000 req/day default limit |
| Daily forecast | **Open-Meteo** | Same API, daily aggregation parameter |
| Sun events (rise/set/noon) | **Open-Meteo** | `daily` response includes `sunrise`, `sunset`, `daylight_duration` |
| Sun position (azimuth/elevation) | **Formula-based** | Computed server-side from lat/lon + UTC timestamp; no external API needed |

### Fallback stack

| Capability | Fallback | When to use |
|---|---|---|
| Geocoding | **Open-Meteo Geocoding API** | If Geoapify is unavailable or daily limit is reached |
| Forecast | No fallback required | Open-Meteo is the only required forecast source |
| Sun events | No fallback required | Derived from the same Open-Meteo daily response |
| Sun position | No fallback required | Formula-based; no external dependency |

The Geoapify fallback (Open-Meteo Geocoding) provides city/town level results
and is sufficient to support approximate location mode.

---

## Normalized Payload Contract

The product code must consume an app-owned normalized shape, not the raw
provider response. All provider-specific field names, units, and structural
quirks are the adapter's concern. The following shapes are the contract between
the weather/location data layer and the Live screen.

### Location resolution result

Produced by the geocoding adapter from a user-entered location string.

```ts
type ResolvedLocation = {
  displayName: string;          // human-readable label returned by provider
  latitude: number;             // decimal degrees, WGS84
  longitude: number;            // decimal degrees, WGS84
  precisionMode: 'exact' | 'approximate';
  countryCode?: string;         // ISO 3166-1 alpha-2, if available
  locality?: string;            // city or town name, if available
};
```

`precisionMode` is set by the user during onboarding and stored with the
location record. The geocoder always returns the most precise result it can;
precision mode is a product-level privacy choice, not a geocoder constraint.

### 12-hour forecast rail

One entry per hour for the next 12 hours from the current UTC time, rounded to
the start of the current hour.

```ts
type HourlyForecastSlot = {
  hourUtc: string;              // ISO 8601 UTC hour start, e.g. "2026-04-03T14:00:00Z"
  temperatureCelsius: number;
  cloudCoverPercent: number;    // 0–100
  precipitationMm: number;
  weatherCode: number;          // WMO weather interpretation code
  isDay: boolean;               // whether this hour falls in daylight
};

type HourlyForecast = {
  slots: HourlyForecastSlot[];  // exactly 12 entries
  fetchedAtUtc: string;
  locationLatitude: number;
  locationLongitude: number;
};
```

### 5-day forecast cards

One entry per calendar day starting from today (local installation timezone).

```ts
type DailyForecastCard = {
  localDate: string;            // YYYY-MM-DD in installation timezone
  temperatureMaxCelsius: number;
  temperatureMinCelsius: number;
  precipitationSumMm: number;
  weatherCode: number;          // WMO weather interpretation code
  sunriseUtc: string;           // ISO 8601 UTC
  sunsetUtc: string;            // ISO 8601 UTC
};

type DailyForecast = {
  days: DailyForecastCard[];    // exactly 5 entries
  fetchedAtUtc: string;
  locationLatitude: number;
  locationLongitude: number;
};
```

### Sun events block

Covers the current local day and is derived from the Open-Meteo daily response.

```ts
type SunEvents = {
  localDate: string;            // YYYY-MM-DD in installation timezone
  sunriseUtc: string;           // ISO 8601 UTC
  sunsetUtc: string;            // ISO 8601 UTC
  solarNoonUtc: string;         // ISO 8601 UTC
  daylightSeconds: number;      // total daylight duration for the day
};
```

`solarNoonUtc` is not a direct Open-Meteo field. It should be derived as the
midpoint between `sunrise` and `sunset` unless a future provider supplies it
directly. Implementation stories should document this derivation explicitly.

`daylightRemainingSeconds` is intentionally excluded from this type. It is a
"from now" value that changes continuously and must not be cached with the
static sun-event data. It belongs in `SunPosition` below, which is computed
fresh on every request.

### Sun position context

Computed server-side from latitude, longitude, and the current UTC timestamp.
No external API is required. The implementation should use a well-known solar
position algorithm (e.g. SPA — Solar Position Algorithm, NREL) or an equivalent
published formula.

```ts
type SunPosition = {
  computedAtUtc: string;        // ISO 8601 UTC timestamp of computation
  elevationDegrees: number;     // solar elevation above horizon (-90 to 90)
  azimuthDegrees: number;       // solar azimuth clockwise from north (0–360)
  isAboveHorizon: boolean;      // elevation > 0
  daylightRemainingSeconds: number; // seconds until sunset; 0 if sun is below horizon
};
```

The product should not make claims about panel output, roof orientation, or
shading from this data. Sun position is sky-relative context only.

---

## Caching Expectations

| Data type | Suggested server-side TTL | Notes |
|---|---|---|
| Geocoding result | Persistent (stored on installation) | Only re-geocode if user changes location |
| 12-hour hourly forecast | 30 minutes | Balance freshness against Open-Meteo rate limits |
| 5-day daily forecast | 1 hour | Daily cards change slowly; 1-hour TTL is sufficient |
| Sun events | 24 hours (per local date) | Static fields only: sunrise, sunset, solar noon, daylight duration — these do not change within a day |
| Sun position | None (computed on demand) | Includes `daylightRemainingSeconds`; must be computed fresh on every request — never cached |

Caching should be implemented server-side. The browser must not call provider
APIs directly (consistent with Decision 0001).

---

## Rate Limits and Provider-Specific Risks

### Geoapify

- Free tier: **3,000 API calls per day**
- Geocoding is only called when a user saves or changes their location, so
  daily call volume should remain very low even at several hundred installations
- Risk: if onboarding involves repeated geocoding attempts (e.g. autocomplete
  lookups on each keystroke), the daily limit could be reached. Implementation
  should gate geocoding to confirmed submissions, not to input events.
- No API key rotation or billing setup required for the free tier, but the key
  is still a server-side secret and must not be exposed to the browser.

### Open-Meteo

- **No API key required** for the non-commercial free tier
- Default rate limit: **10,000 requests per day** per IP address
- Forecast and sun-event data should be fetched in a single combined API call
  per installation per refresh cycle to minimize request count
- Risk: if the product grows significantly, Open-Meteo's non-commercial policy
  may require upgrading to a paid plan. The normalized contract above ensures a
  provider swap would be confined to the adapter layer.
- Open-Meteo data is updated approximately hourly; fetching more frequently
  than the server-side TTL above does not improve data quality.

### Formula-based sun position

- No external dependency, no rate limit, no cost
- Accuracy is sufficient for a sky-relative UI context display; it is not
  intended for precise solar-irradiance modeling

---

## Provider Swap Strategy

The normalized payload shapes above are the stable product contract. Provider
adapters translate raw provider responses into these shapes. Later implementation
stories must:

- keep all provider-specific HTTP calls and field mappings inside an adapter
  module, not inside domain or UI code
- return the normalized types above from adapter functions
- not expose provider field names, URLs, or quirks to the Live screen or domain
  layer

This ensures that replacing Geoapify with another geocoder, or Open-Meteo with
another forecast source, requires only adapter changes, not product or UI changes.

---

## Constraints for Implementation Stories

The following constraints must be respected by P-034, P-035, U-038, U-039, and
Q-013:

1. **Zero-cost only** — no provider that requires billing for the initial
   delivery, including paid Open-Meteo tiers
2. **Server-side only** — no provider API calls from the browser; all external
   HTTP must go through the app backend
3. **Product-driven contract** — adapters must translate to the normalized shapes
   above; the UI never consumes raw provider payloads
4. **Approximate location support** — geocoding must work for both exact and
   approximate (town/city level) location entries; precision mode is stored on
   the installation, not enforced by the geocoder
5. **Graceful degradation** — if geocoding or forecast data is unavailable, the
   Live screen must degrade cleanly (missing-location and partial-failure states
   are covered in FE-004 acceptance criteria)
6. **No weather product scope creep** — the Live screen enhancement must stay
   a contextual aid for interpreting solar data, not a standalone weather product

---

## References

- [FE-004 feature overview](/docs/features/FE-004.md)
- [Open-Meteo forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [Geoapify geocoding API](https://apidocs.geoapify.com/docs/geocoding/)
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Decision 0001 — Runtime Boundaries](/docs/decisions/0001-runtime-boundaries-and-infra-deferral.md)
