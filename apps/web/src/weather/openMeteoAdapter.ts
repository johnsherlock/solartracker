import type { HourlyForecast, HourlyForecastSlot, DailyForecast, DailyForecastCard, SunEvents } from './types';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// ---------------------------------------------------------------------------
// Raw Open-Meteo response shapes (adapter-internal only — not exported)
// ---------------------------------------------------------------------------

type OpenMeteoResponse = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    cloud_cover: number[];
    precipitation: number[];
    weather_code: number[];
    is_day: number[]; // 1 = day, 0 = night
  };
  daily?: {
    time: string[];                // YYYY-MM-DD local dates
    sunrise: string[];             // ISO 8601 local time strings
    sunset: string[];
    daylight_duration: number[];   // seconds
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchOpenMeteo(
  latitude: number,
  longitude: number,
  timezone: string,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'temperature_2m,cloud_cover,precipitation,weather_code,is_day',
    daily: 'sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone,
    forecast_days: '6',
    timeformat: 'iso8601',
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`, {
    next: { revalidate: 0 }, // Next.js fetch — always fresh; caching is in the slice
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo responded with HTTP ${res.status}`);
  }

  return res.json() as Promise<OpenMeteoResponse>;
}

// ---------------------------------------------------------------------------
// Hourly normalization
// ---------------------------------------------------------------------------

/**
 * Extract the 12 hourly slots starting from the current UTC hour.
 * Open-Meteo returns hourly times in the requested timezone (ISO 8601 with offset).
 * We re-express them as UTC ISO 8601 strings for the normalized shape.
 */
export function normalizeHourlyForecast(
  raw: OpenMeteoResponse,
  now: Date,
  latitude: number,
  longitude: number,
): HourlyForecast {
  const h = raw.hourly;
  if (
    !h ||
    !h.time?.length ||
    !h.temperature_2m?.length ||
    !h.cloud_cover?.length ||
    !h.precipitation?.length ||
    !h.weather_code?.length ||
    !h.is_day?.length
  ) {
    throw new Error('Open-Meteo hourly response is missing required fields');
  }

  // Current UTC hour boundary (ms)
  const currentHourMs = Math.floor(now.getTime() / 3_600_000) * 3_600_000;

  // Find the index of the first slot at or after the current UTC hour
  const startIdx = h.time.findIndex((t) => new Date(t).getTime() >= currentHourMs);
  if (startIdx === -1) {
    throw new Error('Open-Meteo hourly response does not cover the current hour');
  }

  const slots: HourlyForecastSlot[] = [];
  for (let i = startIdx; i < h.time.length && slots.length < 12; i++) {
    slots.push({
      hourUtc: new Date(h.time[i]).toISOString(),
      temperatureCelsius: Math.round(h.temperature_2m[i] * 10) / 10,
      cloudCoverPercent: h.cloud_cover[i],
      precipitationMm: Math.round(h.precipitation[i] * 10) / 10,
      weatherCode: h.weather_code[i],
      isDay: h.is_day[i] === 1,
    });
  }

  if (slots.length < 12) {
    throw new Error(`Open-Meteo only returned ${slots.length} hourly slots (need 12)`);
  }

  return {
    slots,
    fetchedAtUtc: now.toISOString(),
    locationLatitude: latitude,
    locationLongitude: longitude,
  };
}

// ---------------------------------------------------------------------------
// Daily normalization
// ---------------------------------------------------------------------------

/**
 * Extract 5 daily cards starting from today's local date.
 * Open-Meteo returns YYYY-MM-DD local dates in the requested timezone.
 */
export function normalizeDailyForecast(
  raw: OpenMeteoResponse,
  todayLocalDate: string,
  now: Date,
  latitude: number,
  longitude: number,
): { dailyForecast: DailyForecast; sunEvents: SunEvents } {
  const d = raw.daily;
  if (
    !d ||
    !d.time?.length ||
    !d.sunrise?.length ||
    !d.sunset?.length ||
    !d.daylight_duration?.length ||
    !d.temperature_2m_max?.length ||
    !d.temperature_2m_min?.length ||
    !d.precipitation_sum?.length ||
    !d.weather_code?.length
  ) {
    throw new Error('Open-Meteo daily response is missing required fields');
  }

  // Find today's index
  const todayIdx = d.time.findIndex((t) => t === todayLocalDate);
  if (todayIdx === -1) {
    throw new Error(`Open-Meteo daily response does not include today (${todayLocalDate})`);
  }

  const days: DailyForecastCard[] = [];
  for (let i = todayIdx; i < d.time.length && days.length < 5; i++) {
    days.push({
      localDate: d.time[i],
      temperatureMaxCelsius: Math.round(d.temperature_2m_max[i] * 10) / 10,
      temperatureMinCelsius: Math.round(d.temperature_2m_min[i] * 10) / 10,
      precipitationSumMm: Math.round(d.precipitation_sum[i] * 10) / 10,
      weatherCode: d.weather_code[i],
      sunriseUtc: new Date(d.sunrise[i]).toISOString(),
      sunsetUtc: new Date(d.sunset[i]).toISOString(),
    });
  }

  if (days.length < 5) {
    throw new Error(`Open-Meteo only returned ${days.length} daily cards (need 5)`);
  }

  // Derive solar noon as midpoint of today's sunrise and sunset
  const sunriseTodayMs = new Date(d.sunrise[todayIdx]).getTime();
  const sunsetTodayMs = new Date(d.sunset[todayIdx]).getTime();
  const solarNoonMs = sunriseTodayMs + Math.floor((sunsetTodayMs - sunriseTodayMs) / 2);

  const sunEvents: SunEvents = {
    localDate: todayLocalDate,
    sunriseUtc: new Date(d.sunrise[todayIdx]).toISOString(),
    sunsetUtc: new Date(d.sunset[todayIdx]).toISOString(),
    solarNoonUtc: new Date(solarNoonMs).toISOString(),
    daylightSeconds: Math.round(d.daylight_duration[todayIdx]),
  };

  const dailyForecast: DailyForecast = {
    days,
    fetchedAtUtc: now.toISOString(),
    locationLatitude: latitude,
    locationLongitude: longitude,
  };

  return { dailyForecast, sunEvents };
}
