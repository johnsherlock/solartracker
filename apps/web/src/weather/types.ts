// Normalized weather and sun-context types
// Defined in Decision 0002 and Decision 0004 — do not extend these shapes.

// ---------------------------------------------------------------------------
// Geocoding / location
// ---------------------------------------------------------------------------

export type LocationContext = {
  displayName: string;
  precisionMode: 'exact' | 'approximate';
  latitude: number;
  longitude: number;
};

// ---------------------------------------------------------------------------
// Hourly forecast (12-hour rail)
// ---------------------------------------------------------------------------

export type HourlyForecastSlot = {
  hourUtc: string;          // ISO 8601 UTC hour start
  temperatureCelsius: number;
  cloudCoverPercent: number; // 0–100
  precipitationMm: number;
  weatherCode: number;       // WMO weather interpretation code
  isDay: boolean;
};

export type HourlyForecast = {
  slots: HourlyForecastSlot[]; // exactly 12 entries
  fetchedAtUtc: string;
  locationLatitude: number;
  locationLongitude: number;
};

// ---------------------------------------------------------------------------
// Daily forecast (5-day cards)
// ---------------------------------------------------------------------------

export type DailyForecastCard = {
  localDate: string;             // YYYY-MM-DD in installation timezone
  temperatureMaxCelsius: number;
  temperatureMinCelsius: number;
  precipitationSumMm: number;
  weatherCode: number;
  sunriseUtc: string;            // ISO 8601 UTC
  sunsetUtc: string;             // ISO 8601 UTC
};

export type DailyForecast = {
  days: DailyForecastCard[];     // exactly 5 entries
  fetchedAtUtc: string;
  locationLatitude: number;
  locationLongitude: number;
};

// ---------------------------------------------------------------------------
// Sun events (current local day, static per day)
// ---------------------------------------------------------------------------

export type SunEvents = {
  localDate: string;       // YYYY-MM-DD in installation timezone
  sunriseUtc: string;      // ISO 8601 UTC
  sunsetUtc: string;       // ISO 8601 UTC
  solarNoonUtc: string;    // midpoint of sunrise/sunset — not a direct API field
  daylightSeconds: number;
};

// ---------------------------------------------------------------------------
// Sun position (computed fresh per request — never cached)
// ---------------------------------------------------------------------------

export type SunPosition = {
  computedAtUtc: string;
  elevationDegrees: number;        // -90 to 90; negative = below horizon
  azimuthDegrees: number;          // 0–360, clockwise from north
  isAboveHorizon: boolean;
  daylightRemainingSeconds: number; // 0 after sunset
};

// ---------------------------------------------------------------------------
// Combined context returned by the server slice
// ---------------------------------------------------------------------------

export type LiveWeatherContext = {
  location: LocationContext;
  sunEvents: SunEvents;
  sunPosition: SunPosition;
  hourlyForecast: HourlyForecast;
  dailyForecast: DailyForecast;
};

// ---------------------------------------------------------------------------
// Slice result union (Decision 0004)
// ---------------------------------------------------------------------------

export type LiveWeatherResult =
  | { status: 'ok'; data: LiveWeatherContext }
  | { status: 'no-location' }
  | { status: 'forecast-unavailable'; sunPosition: SunPosition; sunEvents: SunEvents | null };

// ---------------------------------------------------------------------------
// Internal cache entry (not exported to UI)
// ---------------------------------------------------------------------------

export type WeatherCacheEntry = {
  installationId: string;
  timezone: string;
  cachedLatitude: number;
  cachedLongitude: number;
  hourlyForecast: HourlyForecast;
  hourlyFetchedAt: Date;
  dailyForecast: DailyForecast;
  sunEvents: SunEvents;
  dailyFetchedAt: Date;
};
