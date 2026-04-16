/**
 * Pure helpers for daily summary derivation and local-date logic.
 *
 * No I/O — all functions accept explicit inputs so they are unit-testable
 * without mocking the database or clock.
 */

import type { MinuteReading } from '../live/types';
import { inWindow, resolveSlotIndex, type BandBreakdown, type TariffPricePeriod, type WeeklySchedule } from '../domain/billing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailySummaryFields = {
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  selfConsumptionRatio: number | null;
  gridDependenceRatio: number | null;
  isPartial: boolean;
  dayImportKwh: number | null;
  nightImportKwh: number | null;
  peakImportKwh: number | null;
  freeImportKwh: number | null;
};

export type TariffWindows = {
  nightStartLocalTime: string;
  nightEndLocalTime: string;
  peakStartLocalTime?: string | null;
  peakEndLocalTime?: string | null;
};

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
  // Parse as UTC midnight on the local date string, then subtract one day.
  const d = new Date(`${localToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Return true if the current local time in the given timezone is at or beyond
 * the midnight boundary plus the requested safety buffer.
 *
 * Used to ensure a day is "finalized" before we attempt to summarize it.
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

  // Scan a 27-hour UTC window centred on noon of the calendar date and count
  // how many UTC minutes map to the requested local date.
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

// ---------------------------------------------------------------------------
// Summary derivation
// ---------------------------------------------------------------------------

function r6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Derive persisted daily summary fields from the raw minute readings for a day.
 *
 * @param readings        MinuteReading[] for the local calendar day
 * @param expectedMinutes Expected number of minute records for that day
 *                        (use expectedMinutesForDay() to compute)
 * @param tariffWindows   Optional tariff time windows for band classification.
 *                        When provided, each reading is classified into
 *                        day/night/peak bands. When absent, band fields are null.
 */
export function deriveDailySummaryFields(
  readings: MinuteReading[],
  expectedMinutes: number,
  tariffWindows?: TariffWindows | null,
): DailySummaryFields {
  let importKwh = 0;
  let exportKwh = 0;
  let generatedKwh = 0;
  let consumedKwh = 0;
  let immersionDivertedKwh = 0;
  let immersionBoostedKwh = 0;
  let dayImportKwh = 0;
  let nightImportKwh = 0;
  let peakImportKwh = 0;

  for (const m of readings) {
    importKwh += m.importKwh;
    exportKwh += m.exportKwh;
    generatedKwh += m.generatedKwh;
    consumedKwh += m.consumedKwh;
    immersionDivertedKwh += m.immersionDivertedKwh;
    immersionBoostedKwh += m.immersionBoostedKwh;

    if (tariffWindows) {
      const time = `${String(m.hour).padStart(2, '0')}:${String(m.minute).padStart(2, '0')}`;
      if (inWindow(time, tariffWindows.peakStartLocalTime, tariffWindows.peakEndLocalTime)) {
        peakImportKwh += m.importKwh;
      } else if (inWindow(time, tariffWindows.nightStartLocalTime, tariffWindows.nightEndLocalTime)) {
        nightImportKwh += m.importKwh;
      } else {
        dayImportKwh += m.importKwh;
      }
    }
  }

  importKwh = r6(importKwh);
  exportKwh = r6(exportKwh);
  generatedKwh = r6(generatedKwh);
  consumedKwh = r6(consumedKwh);
  immersionDivertedKwh = r6(immersionDivertedKwh);
  immersionBoostedKwh = r6(immersionBoostedKwh);

  // Self-consumption ratio: fraction of total consumption met by solar.
  // solarConsumed = consumed - grid_import (clamped to ≥0)
  const solarConsumed = Math.max(0, consumedKwh - importKwh);
  const selfConsumptionRatio = consumedKwh > 0 ? solarConsumed / consumedKwh : null;
  const gridDependenceRatio = consumedKwh > 0 ? importKwh / consumedKwh : null;

  const isPartial = readings.length < expectedMinutes;

  const hasBands = tariffWindows != null;

  // Compute night and peak independently, then derive day as the remainder so
  // that dayImportKwh + nightImportKwh + peakImportKwh === importKwh exactly
  // (avoids up to 3 µkWh of floating-point drift from independent rounding).
  const roundedNight = hasBands ? r6(nightImportKwh) : null;
  const roundedPeak  = hasBands ? r6(peakImportKwh)  : null;
  const roundedDay   = hasBands ? importKwh - (roundedNight ?? 0) - (roundedPeak ?? 0) : null;

  return {
    importKwh,
    exportKwh,
    generatedKwh,
    consumedKwh,
    immersionDivertedKwh,
    immersionBoostedKwh,
    selfConsumptionRatio,
    gridDependenceRatio,
    isPartial,
    dayImportKwh: roundedDay,
    nightImportKwh: roundedNight,
    peakImportKwh: roundedPeak,
    freeImportKwh: null,
  };
}

// ---------------------------------------------------------------------------
// Schedule-based band derivation
// ---------------------------------------------------------------------------

export type DailySummaryFieldsScheduled = DailySummaryFields & {
  /**
   * Per-period import kWh totals keyed by TariffPricePeriod id.
   * Null when no schedule was provided (simple-window path).
   */
  bandBreakdownJson: BandBreakdown | null;
  /**
   * Total free-import kWh for the day (sum of all isFreeImport periods).
   * Replaces the fixed freeImportKwh field for schedule-based rows.
   */
  freeImportKwh: number | null;
};

/**
 * Classify one minute reading's import kWh into its price period.
 *
 * @param hour     Reading hour (0–23)
 * @param minute   Reading minute (0–59)
 * @param localDate  YYYY-MM-DD local date (needed for day-of-week resolution)
 * @param schedule   WeeklySchedule (336-element period-id array)
 * @returns the price period id for this minute
 */
function periodIdForMinute(
  hour: number,
  minute: number,
  localDate: string,
  schedule: WeeklySchedule,
): string {
  // Build a minimal datetime string that resolveSlotIndex can parse
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return schedule[resolveSlotIndex(`${localDate}T${hh}:${mm}`)];
}

/**
 * Derive a BandBreakdown from minute readings using a weekly schedule.
 *
 * Each minute's importKwh is accumulated into its price period bucket.
 * Returns both the full breakdown and the total free-import kWh.
 */
export function deriveBandBreakdown(
  readings: MinuteReading[],
  localDate: string,
  schedule: WeeklySchedule,
  periods: TariffPricePeriod[],
): { breakdown: BandBreakdown; freeImportKwh: number } {
  const breakdown: BandBreakdown = {};
  let freeImportKwh = 0;

  for (const m of readings) {
    const periodId = periodIdForMinute(m.hour, m.minute, localDate, schedule);
    if (!periodId) continue;
    breakdown[periodId] = (breakdown[periodId] ?? 0) + m.importKwh;
    const period = periods.find((p) => p.id === periodId);
    if (period?.isFreeImport) {
      freeImportKwh += m.importKwh;
    }
  }

  // Round all period totals to 6 decimal places
  for (const id of Object.keys(breakdown)) {
    breakdown[id] = r6(breakdown[id]);
  }

  return { breakdown, freeImportKwh: r6(freeImportKwh) };
}

/**
 * Derive daily summary fields using a schedule-based tariff.
 *
 * Produces the same energy totals as deriveDailySummaryFields but populates
 * bandBreakdownJson instead of the fixed day/night/peak band columns, which
 * remain null. The freeImportKwh field reflects the sum of all free-period
 * import kWh.
 *
 * @param readings        MinuteReading[] for the local calendar day
 * @param expectedMinutes Expected minute count for the day (from expectedMinutesForDay)
 * @param localDate       YYYY-MM-DD local date string (needed for day-of-week)
 * @param schedule        WeeklySchedule (336-element period-id array)
 * @param periods         TariffPricePeriod[] for this tariff version
 */
export function deriveDailySummaryFieldsScheduled(
  readings: MinuteReading[],
  expectedMinutes: number,
  localDate: string,
  schedule: WeeklySchedule,
  periods: TariffPricePeriod[],
): DailySummaryFieldsScheduled {
  let importKwh = 0;
  let exportKwh = 0;
  let generatedKwh = 0;
  let consumedKwh = 0;
  let immersionDivertedKwh = 0;
  let immersionBoostedKwh = 0;

  for (const m of readings) {
    importKwh += m.importKwh;
    exportKwh += m.exportKwh;
    generatedKwh += m.generatedKwh;
    consumedKwh += m.consumedKwh;
    immersionDivertedKwh += m.immersionDivertedKwh;
    immersionBoostedKwh += m.immersionBoostedKwh;
  }

  importKwh = r6(importKwh);
  exportKwh = r6(exportKwh);
  generatedKwh = r6(generatedKwh);
  consumedKwh = r6(consumedKwh);
  immersionDivertedKwh = r6(immersionDivertedKwh);
  immersionBoostedKwh = r6(immersionBoostedKwh);

  const solarConsumed = Math.max(0, consumedKwh - importKwh);
  const selfConsumptionRatio = consumedKwh > 0 ? solarConsumed / consumedKwh : null;
  const gridDependenceRatio = consumedKwh > 0 ? importKwh / consumedKwh : null;
  const isPartial = readings.length < expectedMinutes;

  const { breakdown, freeImportKwh } = deriveBandBreakdown(readings, localDate, schedule, periods);

  return {
    importKwh,
    exportKwh,
    generatedKwh,
    consumedKwh,
    immersionDivertedKwh,
    immersionBoostedKwh,
    selfConsumptionRatio,
    gridDependenceRatio,
    isPartial,
    // Fixed band fields are null — schedule-based rows use bandBreakdownJson
    dayImportKwh: null,
    nightImportKwh: null,
    peakImportKwh: null,
    freeImportKwh: freeImportKwh > 0 ? freeImportKwh : null,
    bandBreakdownJson: breakdown,
  };
}
