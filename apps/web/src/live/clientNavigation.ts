/**
 * Pure helpers for client-side historical-day navigation.
 *
 * Keeping these as standalone functions (no React dependencies) makes them
 * unit-testable without a DOM or component harness.
 */
import type { HistoricalDayPayload } from '../../app/api/history/[date]/route';

const HISTORICAL_DATE_PATTERN = /^\/history\/(\d{4}-\d{2}-\d{2})$/;

/**
 * Extract the ISO date string from a `/history/YYYY-MM-DD` pathname.
 * Returns `null` for any other path (e.g. `/live`).
 */
export function extractHistoricalDate(pathname: string): string | null {
  const match = pathname.match(HISTORICAL_DATE_PATTERN);
  return match ? match[1] : null;
}

/**
 * Resolve whether a target date can be served from the client-side cache.
 *
 * - Returns `{ type: 'cache-hit', payload }` when the cache has a resolved
 *   entry for `date`.
 * - Returns `{ type: 'cache-miss' }` when `date` is today or future, when
 *   there is no cache entry, or when the cached promise rejects.
 *
 * @param date      ISO date string of the target day.
 * @param today     ISO date string of today (from the installation timezone).
 * @param getCache  Function matching `dayCache.get` — returns a Promise or null.
 */
export async function resolveClientNavigation(
  date: string,
  today: string,
  getCache: (date: string) => Promise<HistoricalDayPayload> | null,
): Promise<{ type: 'cache-hit'; payload: HistoricalDayPayload } | { type: 'cache-miss' }> {
  if (date >= today) return { type: 'cache-miss' };

  const cached = getCache(date);
  if (!cached) return { type: 'cache-miss' };

  try {
    const payload = await cached;
    return { type: 'cache-hit', payload };
  } catch {
    return { type: 'cache-miss' };
  }
}
