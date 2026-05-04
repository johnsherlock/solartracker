import type { RangeSeriesDay } from '../range/types';
import type { RepaymentSchedule } from '../range/recovery';
import { computeRepaymentsForPeriod } from '../range/recovery';
import type { CalendarMetric } from './types';

// ---------------------------------------------------------------------------
// Metric descriptors
// ---------------------------------------------------------------------------

export type CalendarMetricDescriptor = {
  id: CalendarMetric;
  label: string;
  requiresTariff: boolean;
  requiresFinance: boolean;
};

export const CALENDAR_METRICS: CalendarMetricDescriptor[] = [
  { id: 'generation_kwh',       label: 'Generation',          requiresTariff: false, requiresFinance: false },
  { id: 'self_consumed_kwh',    label: 'Self-consumed',        requiresTariff: false, requiresFinance: false },
  { id: 'self_consumed_value',  label: 'Solar value',          requiresTariff: true,  requiresFinance: false },
  { id: 'solar_coverage',       label: 'Solar coverage',       requiresTariff: false, requiresFinance: false },
  { id: 'import_kwh',           label: 'Import',               requiresTariff: false, requiresFinance: false },
  { id: 'import_cost',          label: 'Import cost',          requiresTariff: true,  requiresFinance: false },
  { id: 'export_kwh',           label: 'Export',               requiresTariff: false, requiresFinance: false },
  { id: 'immersion_kwh',        label: 'Immersion',            requiresTariff: false, requiresFinance: false },
  { id: 'net_solar_position',   label: 'Net solar position',   requiresTariff: true,  requiresFinance: false },
  { id: 'prorata_coverage',     label: 'Repayment coverage',   requiresTariff: true,  requiresFinance: true  },
];

// ---------------------------------------------------------------------------
// Per-day repayment helper
// ---------------------------------------------------------------------------

export function getDailyRepayment(schedules: RepaymentSchedule[], date: string): number {
  return computeRepaymentsForPeriod(schedules, date, date, false).amount;
}

// ---------------------------------------------------------------------------
// Value extraction
// ---------------------------------------------------------------------------

/**
 * Returns the raw metric value for a single day, or null when:
 * - the day has no summary
 * - the metric requires billing data but none exists
 * - the metric requires finance data but no schedules are provided
 */
export function extractDayValue(
  day: RangeSeriesDay,
  metric: CalendarMetric,
  schedules: RepaymentSchedule[],
): number | null {
  if (!day.hasSummary) return null;

  switch (metric) {
    case 'generation_kwh':
      return day.generatedKwh;

    case 'self_consumed_kwh': {
      const sc = day.generatedKwh - day.exportKwh;
      return Math.max(0, sc);
    }

    case 'self_consumed_value':
      return day.billing?.selfConsumedSolarValue ?? null;

    case 'solar_coverage': {
      if (!day.consumedKwh || day.consumedKwh <= 0) return null;
      const selfConsumed = Math.max(0, day.generatedKwh - day.exportKwh);
      return selfConsumed / day.consumedKwh;
    }

    case 'import_kwh':
      return day.importKwh;

    case 'import_cost':
      return day.billing?.importCost ?? null;

    case 'export_kwh':
      return day.exportKwh;

    case 'immersion_kwh':
      return day.immersionDivertedKwh ?? null;

    case 'net_solar_position':
      return day.billing?.savings ?? null;

    case 'prorata_coverage': {
      if (!day.billing || schedules.length === 0) return null;
      const dailyRepayment = getDailyRepayment(schedules, day.date);
      if (dailyRepayment <= 0) return null;
      // Raw value is the fractional coverage (1.0 = 100% covered)
      return day.billing.savings / dailyRepayment;
    }
  }
}

/**
 * Secondary value for the combined Export metric — the € credit earned.
 * Used alongside the primary kWh value in year totals and tooltips.
 */
export function extractExportCredit(day: RangeSeriesDay): number | null {
  if (!day.hasSummary) return null;
  return day.billing?.exportCredit ?? null;
}

/**
 * Secondary value for the Immersion metric — the estimated € value of
 * diverted energy, computed at the day's average paid import rate.
 * Falls back to the self-consumed solar rate when there were no paid imports.
 */
export function extractImmersionValue(day: RangeSeriesDay): number | null {
  if (!day.hasSummary || !day.billing) return null;
  const immersionKwh = day.immersionDivertedKwh;
  if (!immersionKwh || immersionKwh <= 0) return null;

  const paidImportKwh = day.importKwh - day.billing.freeImportKwh;
  if (paidImportKwh > 0) {
    return immersionKwh * (day.billing.importCost / paidImportKwh);
  }

  // Fallback: derive rate from self-consumed solar value
  const selfConsumedKwh = Math.max(0, day.generatedKwh - day.exportKwh);
  if (selfConsumedKwh > 0 && day.billing.selfConsumedSolarValue > 0) {
    return immersionKwh * (day.billing.selfConsumedSolarValue / selfConsumedKwh);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export type NormalizedDay = {
  date: string;
  /** 0–1 normalized bar height; null means no data / metric not applicable */
  normalizedHeight: number | null;
  /** raw extracted value (used for tooltip and totals) */
  rawValue: number | null;
};

/**
 * Computes normalized bar heights for a full series against the year peak.
 *
 * For `prorata_coverage` the raw value can exceed 1.0 (e.g. 1.5 = 150% covered)
 * but the normalizedHeight is capped at 1.0 so it maps to a full bar.
 *
 * For all other metrics, normalizedHeight = rawValue / peakRawValue.
 */
export function normalizeSeries(
  series: RangeSeriesDay[],
  metric: CalendarMetric,
  schedules: RepaymentSchedule[],
): NormalizedDay[] {
  const rawValues = series.map((day) => ({
    date: day.date,
    raw: extractDayValue(day, metric, schedules),
  }));

  const peak =
    metric === 'prorata_coverage' || metric === 'solar_coverage'
      ? 1.0
      : Math.max(0, ...rawValues.map((d) => d.raw ?? 0));

  return rawValues.map(({ date, raw }) => {
    if (raw === null) {
      return { date, normalizedHeight: null, rawValue: raw };
    }
    // Negative values are valid data (e.g. negative net position) — show as a
    // zero-height bar so the tooltip still works rather than treating as missing.
    if (raw < 0) {
      return { date, normalizedHeight: 0, rawValue: raw };
    }
    const normalizedHeight = peak > 0 ? Math.min(1, raw / peak) : 0;
    return { date, normalizedHeight, rawValue: raw };
  });
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDayValue(
  rawValue: number,
  metric: CalendarMetric,
  currency: string,
): string {
  switch (metric) {
    case 'generation_kwh':
    case 'self_consumed_kwh':
    case 'import_kwh':
    case 'export_kwh':
    case 'immersion_kwh':
      return `${rawValue.toFixed(2)} kWh`;

    case 'self_consumed_value':
    case 'import_cost':
    case 'net_solar_position':
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(rawValue);

    case 'solar_coverage':
    case 'prorata_coverage':
      return `${Math.round(rawValue * 100)}%`;
  }
}

// ---------------------------------------------------------------------------
// Best-day detection
// ---------------------------------------------------------------------------

/** True for metrics where a lower value is better (import kWh / cost). */
export function isLowerBetter(metric: CalendarMetric): boolean {
  return metric === 'import_kwh' || metric === 'import_cost';
}

/**
 * Returns the set of dates that share the best value for the metric.
 * Returns an empty set for prorata_coverage (no single "best day" concept).
 * For lower-is-better metrics the best day has the minimum raw value.
 * For all others the best day has the maximum raw value (> 0).
 */
export function findBestDates(days: NormalizedDay[], metric: CalendarMetric): Set<string> {
  if (metric === 'prorata_coverage') return new Set();

  const withData = days.filter((d) => d.rawValue !== null);
  if (withData.length === 0) return new Set();

  if (isLowerBetter(metric)) {
    const min = Math.min(...withData.map((d) => d.rawValue!));
    return new Set(withData.filter((d) => d.rawValue === min).map((d) => d.date));
  }

  const max = Math.max(...withData.map((d) => d.rawValue!));
  if (max <= 0) return new Set();
  return new Set(withData.filter((d) => d.rawValue === max).map((d) => d.date));
}

// ---------------------------------------------------------------------------
// Heat-map bar colour
// ---------------------------------------------------------------------------

/** Base hue (degrees) for each metric's colour family. */
export function getMetricHue(metric: CalendarMetric): number {
  switch (metric) {
    case 'generation_kwh':      return 45;   // amber / yellow
    case 'self_consumed_kwh':   return 140;  // green
    case 'self_consumed_value': return 152;  // emerald
    case 'import_kwh':          return 215;  // blue
    case 'import_cost':         return 350;  // rose / red
    case 'export_kwh':          return 198;  // sky
    case 'solar_coverage':      return 28;   // orange
    case 'immersion_kwh':       return 330;  // pink
    case 'net_solar_position':  return 152;  // emerald
    case 'prorata_coverage':    return 145;  // green
  }
}

/**
 * Interpolates a bar colour for a normalised value t ∈ [0, 1].
 * t=0 → dark, muted low-end; t=1 → bright, fully saturated peak.
 */
export function interpolateBarColor(hue: number, t: number): string {
  const s = Math.round(30 + t * 60);  // 30 % → 90 %
  const l = Math.round(15 + t * 45);  // 15 % → 60 %
  return `hsl(${hue}, ${s}%, ${l}%)`;
}
