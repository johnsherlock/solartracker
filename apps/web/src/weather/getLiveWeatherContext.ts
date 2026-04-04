import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { installations } from '@/src/db/schema';
import { fetchOpenMeteo, normalizeHourlyForecast, normalizeDailyForecast } from './openMeteoAdapter';
import { computeSunPosition } from './sunPosition';
import type { LiveWeatherResult, WeatherCacheEntry, SunEvents } from './types';

// ---------------------------------------------------------------------------
// Module-level cache (process-scoped, sufficient for beta scale)
// ---------------------------------------------------------------------------

const cache = new Map<string, WeatherCacheEntry>();

const HOURLY_TTL_MS = 30 * 60 * 1000;  // 30 minutes
const DAILY_TTL_MS  = 60 * 60 * 1000;  // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isCacheValid(entry: WeatherCacheEntry, now: Date, lat: number, lon: number): {
  hourlyOk: boolean;
  dailyOk: boolean;
  locationMatch: boolean;
} {
  const locationMatch =
    Math.abs(entry.cachedLatitude - lat) < 0.0001 &&
    Math.abs(entry.cachedLongitude - lon) < 0.0001;

  if (!locationMatch) {
    return { hourlyOk: false, dailyOk: false, locationMatch: false };
  }

  const hourlyOk = now.getTime() - entry.hourlyFetchedAt.getTime() < HOURLY_TTL_MS;
  // Also invalidate daily cache when the local day has rolled over since it was fetched.
  const dailyOk  =
    now.getTime() - entry.dailyFetchedAt.getTime() < DAILY_TTL_MS &&
    entry.sunEvents.localDate === getTodayLocalDate(entry.timezone);

  return { hourlyOk, dailyOk, locationMatch };
}

// ---------------------------------------------------------------------------
// Main slice function
// ---------------------------------------------------------------------------

export async function getLiveWeatherContext(
  installationId: string,
): Promise<LiveWeatherResult> {
  // 1. Load location fields from DB
  const rows = await db
    .select({
      locationLatitude: installations.locationLatitude,
      locationLongitude: installations.locationLongitude,
      locationPrecisionMode: installations.locationPrecisionMode,
      locationDisplayName: installations.locationDisplayName,
      locationLocality: installations.locationLocality,
      timezone: installations.timezone,
    })
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1);

  const row = rows[0];
  if (!row || row.locationLatitude == null || row.locationLongitude == null) {
    return { status: 'no-location' };
  }

  const latitude  = parseFloat(row.locationLatitude);
  const longitude = parseFloat(row.locationLongitude);
  const timezone  = row.timezone;
  const precisionMode = (row.locationPrecisionMode === 'approximate' ? 'approximate' : 'exact') as 'exact' | 'approximate';
  const displayName =
    precisionMode === 'approximate'
      ? (row.locationLocality ?? row.locationDisplayName ?? '')
      : (row.locationDisplayName ?? '');

  const now = new Date();
  const todayLocalDate = getTodayLocalDate(timezone);

  // 2. Check cache
  const existing = cache.get(installationId);
  const { hourlyOk, dailyOk, locationMatch } = existing
    ? isCacheValid(existing, now, latitude, longitude)
    : { hourlyOk: false, dailyOk: false, locationMatch: false };

  let hourlyForecast = locationMatch && hourlyOk ? existing!.hourlyForecast : null;
  let dailyForecast  = locationMatch && dailyOk  ? existing!.dailyForecast  : null;
  let sunEvents: SunEvents | null = locationMatch && dailyOk ? existing!.sunEvents : null;
  let hourlyFetchedAt = locationMatch && hourlyOk ? existing!.hourlyFetchedAt : now;
  let dailyFetchedAt  = locationMatch && dailyOk  ? existing!.dailyFetchedAt  : now;

  // 3. Fetch from Open-Meteo if any part is stale
  let fetchError = false;
  if (!hourlyForecast || !dailyForecast) {
    try {
      const raw = await fetchOpenMeteo(latitude, longitude, timezone);

      if (!hourlyForecast) {
        hourlyForecast = normalizeHourlyForecast(raw, now, latitude, longitude);
        hourlyFetchedAt = now;
      }
      if (!dailyForecast) {
        const normalized = normalizeDailyForecast(raw, todayLocalDate, now, latitude, longitude);
        dailyForecast = normalized.dailyForecast;
        sunEvents     = normalized.sunEvents;
        dailyFetchedAt = now;
      }
    } catch {
      fetchError = true;
    }
  }

  // 4. Update cache with whatever we have
  if (hourlyForecast && dailyForecast && sunEvents) {
    cache.set(installationId, {
      installationId,
      timezone,
      cachedLatitude: latitude,
      cachedLongitude: longitude,
      hourlyForecast,
      hourlyFetchedAt,
      dailyForecast,
      sunEvents,
      dailyFetchedAt,
    });
  }

  // 5. Compute sun position fresh (never cached)
  const sunPosition = computeSunPosition(latitude, longitude, now, sunEvents?.sunsetUtc ?? null);

  // 6. Return result
  if (fetchError || !hourlyForecast || !dailyForecast || !sunEvents) {
    return {
      status: 'forecast-unavailable',
      sunPosition,
      sunEvents: sunEvents ?? null,
    };
  }

  return {
    status: 'ok',
    data: {
      location: { displayName, precisionMode, latitude, longitude },
      sunEvents,
      sunPosition,
      hourlyForecast,
      dailyForecast,
    },
  };
}
