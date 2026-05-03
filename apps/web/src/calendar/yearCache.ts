import type { RangeSummaryPayload } from '../range/types';

// Module-level cache shared across the browser session.
const cache = new Map<string, RangeSummaryPayload>();

export function getCachedYear(year: string): RangeSummaryPayload | undefined {
  return cache.get(year);
}

export function setCachedYear(year: string, payload: RangeSummaryPayload): void {
  cache.set(year, payload);
}

export async function fetchOrGetYear(year: string): Promise<RangeSummaryPayload> {
  const cached = cache.get(year);
  if (cached) return cached;

  const res = await fetch(`/api/range?from=${year}-01-01&to=${year}-12-31`);
  if (!res.ok) throw new Error(`Failed to load year ${year}: ${res.status}`);
  const payload = (await res.json()) as RangeSummaryPayload;
  cache.set(year, payload);
  return payload;
}
