/**
 * Pure helpers for interval reading aggregation and local-date logic.
 *
 * No I/O — all functions accept explicit inputs so they are unit-testable
 * without mocking the database or clock.
 */

import type { MinuteReading } from '../live/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntervalSlot = {
  intervalStart: Date;
  importKwh: number;
  generationKwh: number;
  exportKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  consumedKwh: number;
  readingCount: number;
};

export const PARTIAL_DAY_COVERAGE_THRESHOLD = 0.9;

// ---------------------------------------------------------------------------
// Local-date helpers
// ---------------------------------------------------------------------------

/**
 * Return today's local calendar date in the given timezone as YYYY-MM-DD.
 */
export function getLocalDate(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Return the previous local calendar date (yesterday) in the given timezone.
 *
 * DST-safe: we derive the local date via Intl first, then subtract one
 * calendar day from the date string — no fixed UTC-offset arithmetic.
 */
export function getPreviousLocalDate(timezone: string, now: Date = new Date()): string {
  const localToday = getLocalDate(timezone, now);
  const d = new Date(`${localToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Return true if the current local time in the given timezone is at or beyond
 * the midnight boundary plus the requested safety buffer.
 *
 * @param timezone      IANA timezone (e.g. "Europe/Dublin")
 * @param bufferMinutes Minutes after local midnight to wait before treating
 *                      the previous day as final. Default: 15.
 * @param now           Clock override for testing.
 */
export function isAfterMidnightBuffer(
  timezone: string,
  bufferMinutes = 15,
  now: Date = new Date(),
): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= bufferMinutes;
}

// ---------------------------------------------------------------------------
// Expected minutes for a local day (handles DST 23h / 24h / 25h days)
// ---------------------------------------------------------------------------

/**
 * Count how many minutes belong to the given local calendar date in the given
 * timezone. Returns 1380 (spring-forward), 1440 (normal), or 1500 (fall-back).
 */
export function expectedMinutesForDay(localDate: string, timezone: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const windowStart = utcNoon - 14 * 60 * 60 * 1000;
  const windowEnd   = utcNoon + 13 * 60 * 60 * 1000;
  let count = 0;

  for (let ts = windowStart; ts < windowEnd; ts += 60_000) {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    if (get('year') === year && get('month') === month && get('day') === day) {
      count++;
    }
  }

  return count;
}

/**
 * Return true when the observed minute-level coverage for a local day falls
 * below the tolerated completeness threshold.
 */
export function isPartialDay(
  totalReadingCount: number,
  expectedMinutes: number,
  threshold = PARTIAL_DAY_COVERAGE_THRESHOLD,
): boolean {
  if (expectedMinutes <= 0) return false;
  return totalReadingCount / expectedMinutes < threshold;
}

// ---------------------------------------------------------------------------
// UTC start of a local date
// ---------------------------------------------------------------------------

/**
 * Return the UTC millisecond timestamp of the first instant that belongs to the
 * given local calendar date in the given timezone.
 *
 * Uses the same 27-hour scan window as expectedMinutesForDay, iterating in
 * 1-minute steps to find the boundary. DST-safe for all IANA timezones.
 */
export function utcStartOfLocalDate(localDate: string, timezone: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const windowStart = utcNoon - 14 * 60 * 60 * 1000;
  const windowEnd   = utcNoon + 13 * 60 * 60 * 1000;

  for (let ts = windowStart; ts < windowEnd; ts += 60_000) {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    if (get('year') === year && get('month') === month && get('day') === day) {
      return ts;
    }
  }

  // Fallback: UTC midnight (should never be reached for valid IANA timezones)
  return Date.UTC(year, month - 1, day, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Interval reading aggregation
// ---------------------------------------------------------------------------

function r6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Group MinuteReading[] into 30-minute UTC-aligned IntervalSlots.
 *
 * Readings are expected in UTC-chronological order (as returned by
 * normaliseEddiRecords). Slots are assigned sequentially: readings[0..29]
 * → slot 0, readings[30..59] → slot 1, etc. The UTC start of slot i is
 * utcStartOfLocalDate + i × 30 minutes.
 *
 * This position-based grouping is DST-correct for all cases including
 * fall-back days (where the same local hour appears twice): the underlying
 * UTC timestamps advance monotonically regardless of local clock resets.
 */
export function aggregateToIntervalReadings(
  readings: MinuteReading[],
  localDate: string,
  timezone: string,
): IntervalSlot[] {
  if (readings.length === 0) return [];

  const utcStart = utcStartOfLocalDate(localDate, timezone);
  const slotDurationMs = 30 * 60 * 1000;

  // Determine total slot count from expected minutes so we always produce the
  // right number of slots even when the day has fewer readings (partial day).
  const expectedMinutes = expectedMinutesForDay(localDate, timezone);
  const totalSlots = Math.ceil(expectedMinutes / 30);

  // Assign each reading to the slot for its local half-hour.
  // Using the reading's actual hour/minute rather than its sequential position
  // ensures that gaps in the API data leave the correct slots empty/partial
  // instead of shifting later readings into earlier half-hours.
  const slotBuckets: MinuteReading[][] = Array.from({ length: totalSlots }, () => []);
  for (const reading of readings) {
    const minuteOfDay = reading.hour * 60 + reading.minute;
    const slotIndex = Math.min(Math.floor(minuteOfDay / 30), totalSlots - 1);
    slotBuckets[slotIndex].push(reading);
  }

  return slotBuckets.map((bucket, i) => {
    let importKwh = 0;
    let generationKwh = 0;
    let exportKwh = 0;
    let immersionDivertedKwh = 0;
    let immersionBoostedKwh = 0;
    let consumedKwh = 0;

    for (const m of bucket) {
      importKwh += m.importKwh;
      generationKwh += m.generatedKwh;
      exportKwh += m.exportKwh;
      immersionDivertedKwh += m.immersionDivertedKwh;
      immersionBoostedKwh += m.immersionBoostedKwh;
      consumedKwh += m.consumedKwh;
    }

    return {
      intervalStart: new Date(utcStart + i * slotDurationMs),
      importKwh: r6(importKwh),
      generationKwh: r6(generationKwh),
      exportKwh: r6(exportKwh),
      immersionDivertedKwh: r6(immersionDivertedKwh),
      immersionBoostedKwh: r6(immersionBoostedKwh),
      consumedKwh: r6(consumedKwh),
      readingCount: bucket.length,
    };
  });
}
