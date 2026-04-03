# Decision Record 0004: Live Weather and Sun-Context Server Slice Contract

## Status

Accepted

## Date

2026-04-03

## Context

The Live screen `Next` section (specified in `docs/ui/live-next-section.md`)
requires four categories of data: hourly forecast, daily forecast, sun events,
and current sun position. This record specifies exactly how the server-side
slice responsible for producing this data should be structured, what it must
return, how it caches results, and how it degrades when external data is
unavailable.

This is a design contract record. Route or service implementation belongs to
U-039.

---

## Slice Responsibilities

The slice function — referred to as `getLiveWeatherContext` — is a server-side
async function called during the Live page render. It must:

1. Read persisted installation location from the database
2. Return `{ status: 'no-location' }` immediately if no location is stored
3. Serve cached forecast and sun-event data if within TTL
4. Fetch a combined hourly + daily forecast from Open-Meteo when cache is stale
5. Compute current sun position formula-based from lat/lon + current UTC time
6. Return a typed result shape that the Live screen can consume directly

The slice must never call a geocoding API. Geocoding happens only during
onboarding or when a user edits their location in settings.

---

## Location Loading

The slice reads the following fields from the `installations` row for the
current installation:

| Field | Used for |
|---|---|
| `location_latitude` | Presence check; forecast and sun-position input |
| `location_longitude` | Forecast and sun-position input |
| `location_precision_mode` | Included in the result for UI label selection |
| `location_display_name` | Included in the result for the location label |
| `location_locality` | Fallback display value in approximate mode |
| `location_geocoded_at` | Cache invalidation check (see below) |

**Early exit:** If `location_latitude` is `null`, the slice returns
`{ status: 'no-location' }` and makes no external API calls.

---

## Open-Meteo Request Structure

Forecast and sun-event data are fetched in a **single combined HTTP request**
to the Open-Meteo forecast API. Combining both hourly and daily parameter
groups into one request minimises the daily call count against Open-Meteo's
10,000 request/day limit.

### Endpoint

```
GET https://api.open-meteo.com/v1/forecast
```

### Required query parameters

| Parameter | Value |
|---|---|
| `latitude` | Installation latitude |
| `longitude` | Installation longitude |
| `hourly` | `temperature_2m,cloud_cover,precipitation,weather_code,is_day` |
| `daily` | `sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` |
| `timezone` | Installation timezone (e.g. `Europe/Dublin`) |
| `forecast_days` | `6` |
| `timeformat` | `iso8601` |

Setting `timezone` to the installation timezone ensures the `daily` response
entries are aligned to local calendar dates. `forecast_days=6` provides today
plus five forward days, giving enough headroom to slice exactly five daily
cards after timezone alignment.

No API key is required for the Open-Meteo non-commercial free tier.

### 12-hour hourly slice

From the `hourly` response, select the 12 entries starting from the start of
the current UTC hour. Convert `hourly.time[i]` values to UTC for slot
alignment (Open-Meteo returns them in the requested timezone; the adapter must
re-express them as UTC ISO 8601 strings for the normalized shape).

### 5-day daily slice

From the `daily` response, select the 5 entries whose `time` value matches
today's local date and the following four calendar days. Discard any leading
past-day entries if the API returns them.

### Solar noon derivation

Open-Meteo does not return solar noon directly. Derive it as the midpoint
between the day's `sunrise` and `sunset` timestamps:

```
solarNoonUtc = sunrise_utc + (sunset_utc - sunrise_utc) / 2
```

This must be computed in the adapter before the result is returned, not in
the UI layer.

---

## Sun Position Computation

Sun position is **computed server-side on every request** using a formula-based
approach. No external API is required and the result must never be cached,
because it includes `daylightRemainingSeconds` which changes continuously.

### Recommended library

[`suncalc`](https://github.com/mourner/suncalc) (MIT licence, no external
calls, TypeScript-compatible via `@types/suncalc`). It implements the VSOP87
simplified equations and is accurate to within a fraction of a degree for
sky-context display purposes.

Alternative: a direct implementation of the simplified solar position
equations is equally acceptable if the team prefers zero additional
dependencies.

### Inputs

- `latitude` — installation latitude
- `longitude` — installation longitude
- `now` — current UTC `Date` at the time of the server request

### Outputs mapped to `SunPosition`

| `SunPosition` field | Source |
|---|---|
| `computedAtUtc` | `now.toISOString()` |
| `elevationDegrees` | `suncalc.getPosition(now, lat, lon).altitude` converted from radians to degrees |
| `azimuthDegrees` | `suncalc.getPosition(now, lat, lon).azimuth` converted from radians to degrees, offset from south to clockwise-from-north |
| `isAboveHorizon` | `elevationDegrees > 0` |
| `daylightRemainingSeconds` | `Math.max(0, (sunsetUtc - now) / 1000)` where `sunsetUtc` is from today's `SunEvents` |

**After-sunset behavior:** `daylightRemainingSeconds` is `0` when
`now >= sunsetUtc`. `isAboveHorizon` is `false`. `elevationDegrees` is
negative. These are correct values, not error states.

**Computation failure:** If the library throws unexpectedly, default to
`elevationDegrees: 0`, `azimuthDegrees: 180`, `isAboveHorizon: false`,
`daylightRemainingSeconds: 0`. Log the error against the installation ID
without logging coordinates.

---

## Cache Strategy

The slice maintains a **module-level `Map`** keyed by `installationId`. The
cache is process-scoped. This is sufficient for beta scale and avoids
introducing a persistent cache table or external cache dependency.

### Cache entry structure

```ts
type WeatherCacheEntry = {
  installationId: string;
  cachedLatitude: number;
  cachedLongitude: number;
  hourlyForecast: HourlyForecast;
  hourlyFetchedAt: Date;
  dailyForecast: DailyForecast;
  sunEvents: SunEvents;
  dailyFetchedAt: Date;
};
```

### TTL rules

| Data | TTL | Rationale |
|---|---|---|
| `hourlyForecast` | 30 minutes | Open-Meteo updates hourly; 30-min TTL balances freshness and call count |
| `dailyForecast` + `sunEvents` | 1 hour | Daily cards change slowly; sun events are static within a day |
| `sunPosition` | Not cached | Computed fresh on every request; includes `daylightRemainingSeconds` |

### Cache invalidation on location change

Before serving a cached entry, the slice must compare the cache entry's
`cachedLatitude` and `cachedLongitude` against the current installation
values. If they differ (i.e. the user has updated their location since the
entry was written), the cached entry must be discarded and a fresh fetch
performed.

This ensures that a location edit takes effect on the next Live page load
without requiring a cache flush mechanism.

### Cache lookup flow

```
1. Load installation location fields from DB
2. If location_latitude is null → return { status: 'no-location' }
3. Look up cache entry for installationId
4. If entry exists:
   a. If lat/lon mismatch → discard entry, proceed to fetch
   b. If hourlyFetchedAt + 30min < now → re-fetch hourly only
   c. If dailyFetchedAt + 1hr < now → re-fetch daily + sun events
   d. Otherwise → serve from cache
5. Fetch Open-Meteo (combined or partial depending on staleness)
6. Compute sun position fresh
7. Return LiveWeatherResult
```

---

## Return Types

The slice returns one of three typed results. The Live screen must pattern-
match on `status` and never assume `data` is present without checking.

```ts
type LiveWeatherResult =
  | { status: 'ok'; data: LiveWeatherContext }
  | { status: 'no-location' }
  | { status: 'forecast-unavailable'; sunPosition: SunPosition; sunEvents: SunEvents | null };
```

### `LiveWeatherContext`

```ts
type LiveWeatherContext = {
  location: {
    displayName: string;       // label for the location badge in the UI
    precisionMode: 'exact' | 'approximate';
    latitude: number;
    longitude: number;
  };
  sunEvents: SunEvents;        // as defined in Decision 0002
  sunPosition: SunPosition;    // as defined in Decision 0002
  hourlyForecast: HourlyForecast;  // as defined in Decision 0002
  dailyForecast: DailyForecast;    // as defined in Decision 0002
};
```

All sub-types (`SunEvents`, `SunPosition`, `HourlyForecast`, `DailyForecast`,
`HourlyForecastSlot`, `DailyForecastCard`) are the shapes defined in
Decision 0002 and must not be extended or modified in the implementation.

### `displayName` selection

- If `location_precision_mode = 'exact'`: use `location_display_name`
- If `location_precision_mode = 'approximate'`: use `location_locality` if
  present; fall back to `location_display_name` if `location_locality` is null

---

## Graceful Degradation

### No location set

- Slice returns `{ status: 'no-location' }` immediately
- No external API calls are made
- Live screen renders a setup prompt in place of the `Next` modules
- Realtime energy section is unaffected

### Open-Meteo fetch failure

If the Open-Meteo request fails (network error, non-200 response, or
malformed response body):

- Sun position is still computed from the stored lat/lon and current time
- Cached `SunEvents` are returned if a valid cache entry exists for today's
  local date
- Slice returns `{ status: 'forecast-unavailable', sunPosition, sunEvents }`
- Live screen renders sun events and sun position if available; shows
  "Forecast unavailable" state for the rail and 5-day cards
- The Live screen must not show a page-level error; the failure is scoped to
  the weather modules only

### Partial Open-Meteo response

If the response body is present but missing expected fields (e.g. `hourly` is
present but `daily` is absent):

- Parse and cache whichever sections are valid
- Treat missing sections as if the fetch failed for those sections only
- Return `forecast-unavailable` if either section is missing from the result

### Sun position computation failure

- Default to `{ elevationDegrees: 0, azimuthDegrees: 180, isAboveHorizon: false, daylightRemainingSeconds: 0, computedAtUtc: now.toISOString() }`
- Log the error against the installation ID (not coordinates)
- Continue returning the rest of the result normally

---

## What U-039 Must Not Do

These constraints apply to the Live module implementation story:

1. **No direct Open-Meteo calls from the browser** — all forecast data must
   come through the server slice
2. **No raw Open-Meteo field names in UI code** — the UI consumes only the
   normalized types from Decision 0002
3. **No client-side caching of forecast data** — the slice owns the cache
4. **No sun position computation in the browser** — elevation and azimuth
   must arrive as pre-computed values from the server
5. **No location precision enforcement in the geocoder** — precision mode
   is a display-layer concern only; the slice passes it through as a label
   selector

---

## Future Upgrade Paths (Not In Scope For U-039)

- **Edge caching**: replace the in-memory Map with a Vercel Edge Config or
  similar mechanism when deployment targets an edge runtime
- **Per-installation cache warming**: background job pre-fetches forecast for
  active installations before the first Live page load
- **Stale-location background re-geocode**: the 90-day re-geocode trigger
  defined in Decision 0003 can be wired into the slice without changing the
  return contract

---

## References

- [FE-004 feature overview](/docs/features/FE-004.md)
- [U-038 UX spec — Live Next section](/docs/ui/live-next-section.md)
- [Decision 0002 — Weather, Location, and Sun-Context Provider Contract](/docs/decisions/0002-weather-location-provider-contract.md)
- [Decision 0003 — Installation Location Model and Geocoding Persistence](/docs/decisions/0003-installation-location-model.md)
- [Decision 0001 — Runtime Boundaries and Infra Deferral](/docs/decisions/0001-runtime-boundaries-and-infra-deferral.md)
- [suncalc library](https://github.com/mourner/suncalc)
- [Open-Meteo forecast API](https://open-meteo.com/en/docs)
