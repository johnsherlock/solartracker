/**
 * Client-side module-level cache for historical day payloads.
 *
 * The Map persists across client-side route navigations within a single browser
 * session and is cleared on full page reload. Values are stored as Promises so
 * in-flight requests are automatically deduplicated.
 *
 * This module has no React dependencies so it can be tested without a DOM.
 */
import type { HistoricalDayPayload } from '../../app/api/history/[date]/route';

const cache = new Map<string, Promise<HistoricalDayPayload>>();

/**
 * Prefetch a historical day payload and store it in the cache.
 *
 * No-op when:
 * - `date` is today or in the future (guards against caching invalid data)
 * - `date` is already in the cache (deduplicates in-flight requests)
 */
export function prefetch(date: string, today: string): void {
  if (date >= today) return;
  if (cache.has(date)) return;

  cache.set(
    date,
    fetch(`/api/history/${date}`).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch history for ${date}: ${res.status}`);
      }
      return res.json() as Promise<HistoricalDayPayload>;
    }),
  );
}

/**
 * Retrieve a cached payload promise for `date`, or `null` if not yet cached.
 */
export function get(date: string): Promise<HistoricalDayPayload> | null {
  return cache.get(date) ?? null;
}

/**
 * Clear all cached entries. Intended for testing only.
 */
export function _reset(): void {
  cache.clear();
}
