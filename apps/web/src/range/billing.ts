/**
 * Range-level billing composition from persisted interval readings.
 *
 * Builds the full RangeSummaryPayload shape (minus meta) by:
 *  - grouping IntervalRow[] by local date using the installation timezone
 *  - computing per-slot import cost and self-consumed solar value at the exact
 *    tariff rate for that UTC slot
 *  - computing per-slot counterfactual (no-solar) cost at the same slot rate
 *  - detecting tariff version changes across the range
 *  - reporting missing-day completeness
 */

import {
  getScheduledRateForInterval,
  fixedChargeContributionForDate,
  resolveTariffVersion,
  type ScheduledTariffVersion,
  type FixedChargeVersion,
} from '../domain/billing';
import { expectedMinutesForDay, isPartialDay } from '../jobs/derive-summary';
import type {
  RangeSummarySection,
  RangeSeriesDay,
  RangeSummaryHealth,
} from './types';
import type { IntervalRow } from './loader';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Generate all YYYY-MM-DD calendar dates from `from` to `to` inclusive.
 * Uses UTC date arithmetic on the date strings — timezone-safe because we
 * operate on local-date strings only, not on wall-clock timestamps.
 */
export function allDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return dates;
}

// ---------------------------------------------------------------------------
// UTC → local datetime conversion
// ---------------------------------------------------------------------------

const localDateTimeFormatter = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/**
 * Convert a UTC Date to a "YYYY-MM-DDTHH:MM" local datetime string in the
 * given timezone — the format expected by getScheduledRateForInterval.
 */
function utcToLocalDateTime(utc: Date, timezone: string): string {
  const parts = localDateTimeFormatter(timezone).formatToParts(utc);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Return the local date (YYYY-MM-DD) for a UTC Date in the given timezone.
 */
function utcToLocalDate(utc: Date, timezone: string): string {
  return utcToLocalDateTime(utc, timezone).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Per-day billing from interval slots
// ---------------------------------------------------------------------------

type DayAccumulator = {
  importKwh: number;
  generationKwh: number;
  exportKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  totalReadingCount: number;
  slotCount: number;
  // Billing accumulators
  actualImportCost: number;
  selfConsumedSolarValue: number;
  exportCredit: number;
  withoutSolarImportCost: number;
  freeImportKwh: number;
};

function emptyAccumulator(): DayAccumulator {
  return {
    importKwh: 0, generationKwh: 0, exportKwh: 0,
    consumedKwh: 0, immersionDivertedKwh: 0, immersionBoostedKwh: 0,
    totalReadingCount: 0, slotCount: 0,
    actualImportCost: 0, selfConsumedSolarValue: 0,
    exportCredit: 0, withoutSolarImportCost: 0, freeImportKwh: 0,
  };
}

// ---------------------------------------------------------------------------
// Health derivation
// ---------------------------------------------------------------------------

function deriveHealth(
  allDates: string[],
  dayMap: Map<string, DayAccumulator>,
  tariffVersions: ScheduledTariffVersion[],
  timezone: string,
): RangeSummaryHealth {
  const missingDayDates: string[] = [];
  let partialDays = 0;
  const applicableVersionIds = new Set<string>();
  const setupWarnings: string[] = [];
  const hasTariff = tariffVersions.length > 0;

  for (const date of allDates) {
    const day = dayMap.get(date);

    if (!day) {
      missingDayDates.push(date);
    } else {
      const expectedMinutes = expectedMinutesForDay(date, timezone);
      if (isPartialDay(day.totalReadingCount, expectedMinutes)) {
        partialDays++;
      }
    }

    if (hasTariff) {
      try {
        const version = resolveTariffVersion(tariffVersions, `${date}T12:00`);
        applicableVersionIds.add(version.id);
      } catch {
        // No tariff coverage for this date
      }
    }
  }

  if (!hasTariff) {
    setupWarnings.push('No tariff data found. Add a tariff plan to enable billing estimates.');
  }

  const totalDays = allDates.length;
  const coveredDays = totalDays - missingDayDates.length;
  const completenessRatio = totalDays > 0 ? coveredDays / totalDays : 0;

  return {
    totalDays,
    coveredDays,
    missingDays: missingDayDates.length,
    missingDayDates,
    partialDays,
    completenessRatio,
    hasTariffChange: applicableVersionIds.size > 1,
    tariffVersionIds: Array.from(applicableVersionIds),
    hasTariff,
    setupWarnings,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export type RangeComputeResult = {
  summary: RangeSummarySection;
  series: RangeSeriesDay[];
  health: RangeSummaryHealth;
};

/**
 * Compute the full range summary from persisted interval readings.
 *
 * Each 30-minute slot is priced at its exact scheduled tariff rate (import cost
 * and self-consumed solar value). The no-solar counterfactual is also priced
 * per slot at the same rate — giving an exact estimate rather than a flat-rate
 * approximation.
 *
 * @param intervals      IntervalRow[] for the requested range, ordered by interval_start
 * @param allDates       All calendar dates in the range, inclusive (from allDatesInRange)
 * @param timezone       Installation timezone (IANA, e.g. "Europe/Dublin")
 * @param tariffVersions All tariff versions for the installation
 * @param fixedCharges   All fixed charge versions for the installation
 */
export function computeRangeSummary(
  intervals: IntervalRow[],
  allDates: string[],
  timezone: string,
  tariffVersions: ScheduledTariffVersion[],
  fixedCharges: FixedChargeVersion[],
): RangeComputeResult {
  // Group interval rows by local date.
  const dayMap = new Map<string, DayAccumulator>();

  for (const slot of intervals) {
    const localDate = utcToLocalDate(slot.intervalStart, timezone);
    const acc = dayMap.get(localDate) ?? emptyAccumulator();

    acc.importKwh += slot.importKwh;
    acc.generationKwh += slot.generationKwh;
    acc.exportKwh += slot.exportKwh;
    acc.consumedKwh += slot.consumedKwh;
    acc.immersionDivertedKwh += slot.immersionDivertedKwh;
    acc.immersionBoostedKwh += slot.immersionBoostedKwh;
    acc.totalReadingCount += slot.readingCount;
    acc.slotCount += 1;

    // Per-slot billing (only when tariff versions are available)
    if (tariffVersions.length > 0) {
      try {
        const localDateTime = utcToLocalDateTime(slot.intervalStart, timezone);
        const tariff = resolveTariffVersion(tariffVersions, localDateTime) as ScheduledTariffVersion;
        const vat = 1 + (tariff.vatRate ?? 0);
        const discount = tariff.discountRuleType === 'percentage' && tariff.discountValue != null
          ? 1 - tariff.discountValue
          : 1;

        const schedule = tariff.weeklySchedule;
        const periods = tariff.pricePeriods;

        const slotRate = schedule && periods.length > 0
          ? getScheduledRateForInterval(periods, schedule, localDateTime)
          : tariff.dayRate;

        // Track kWh imported at zero rate — observed from data, not modelled in schema
        if (slotRate === 0 && slot.importKwh > 0) {
          acc.freeImportKwh += slot.importKwh;
        }

        // Actual import cost for this slot
        acc.actualImportCost += slot.importKwh * slotRate * discount * vat;

        // Self-consumed solar value: generation not exported or diverted, priced at the
        // slot's import rate (what the household would have paid to import it instead)
        const selfConsumed = Math.max(0, slot.generationKwh - slot.exportKwh - slot.immersionDivertedKwh);
        acc.selfConsumedSolarValue += selfConsumed * slotRate * discount * vat;

        // Export credit (flat rate, unchanged)
        acc.exportCredit += slot.exportKwh * (tariff.exportRate ?? 0);

        // No-solar counterfactual: same slot, same rate — exact rather than estimated
        const withoutSolarImport = Math.max(0, slot.importKwh + slot.generationKwh - slot.exportKwh - slot.immersionDivertedKwh);
        acc.withoutSolarImportCost += withoutSolarImport * slotRate * discount * vat;
      } catch {
        // No tariff coverage for this slot — billing stays at 0 for this slot
      }
    }

    dayMap.set(localDate, acc);
  }

  // Build per-day series entries
  const series: RangeSeriesDay[] = allDates.map((date) => {
    const acc = dayMap.get(date);
    if (!acc) {
      return {
        date,
        hasSummary: false,
        generatedKwh: 0,
        importKwh: 0,
        exportKwh: 0,
        consumedKwh: null,
        immersionDivertedKwh: null,
        isPartial: false,
        billing: null,
        tariffVersionId: null,
        dayImportKwh: null,
        nightImportKwh: null,
        peakImportKwh: null,
      };
    }

    const expectedMinutes = expectedMinutesForDay(date, timezone);
    const isPartial = isPartialDay(acc.totalReadingCount, expectedMinutes);

    let billing: RangeSeriesDay['billing'] = null;
    let tariffVersionId: string | null = null;

    if (tariffVersions.length > 0) {
      try {
        const tariff = resolveTariffVersion(tariffVersions, `${date}T12:00`) as ScheduledTariffVersion;
        tariffVersionId = tariff.id;
        const dayFixedCharges = fixedChargeContributionForDate(date, tariff.id, fixedCharges);
        const importCost = r2(acc.actualImportCost);
        const exportCredit = r2(acc.exportCredit);
        const withoutSolarImportCost = r2(acc.withoutSolarImportCost);
        const actualNetCost = r2(importCost + dayFixedCharges - exportCredit);
        const withoutSolarNetCost = r2(withoutSolarImportCost + dayFixedCharges);
        const savings = r2(withoutSolarNetCost - actualNetCost);
        const selfConsumedSolarValue = r2(acc.selfConsumedSolarValue);
        const freeImportKwh = r6(acc.freeImportKwh);
        billing = { importCost, exportCredit, fixedCharges: dayFixedCharges, actualNetCost, savings, selfConsumedSolarValue, freeImportKwh };
      } catch {
        // No tariff coverage for this day
      }
    }

    return {
      date,
      hasSummary: true,
      generatedKwh: r6(acc.generationKwh),
      importKwh: r6(acc.importKwh),
      exportKwh: r6(acc.exportKwh),
      consumedKwh: r6(acc.consumedKwh),
      immersionDivertedKwh: r6(acc.immersionDivertedKwh),
      isPartial,
      billing,
      tariffVersionId,
      // Band-level breakdowns are no longer stored — deferred to P-054
      dayImportKwh: null,
      nightImportKwh: null,
      peakImportKwh: null,
    };
  });

  // Range-level totals and billing
  const allDays = [...dayMap.values()];
  const totalGeneratedKwh = allDays.reduce((s, d) => s + d.generationKwh, 0);
  const totalImportKwh    = allDays.reduce((s, d) => s + d.importKwh, 0);
  const totalExportKwh    = allDays.reduce((s, d) => s + d.exportKwh, 0);
  const totalConsumedKwh  = allDays.reduce((s, d) => s + d.consumedKwh, 0);
  const totalImmersionDivertedKwh = allDays.reduce((s, d) => s + d.immersionDivertedKwh, 0);

  // Sum range-level billing over only tariff-covered days
  let rangeImportCost = 0;
  let rangeExportCredit = 0;
  let rangeSelfConsumedSolarValue = 0;
  let rangeFixedCharges = 0;
  let rangeWithoutSolarImportCost = 0;

  for (const [date, acc] of dayMap) {
    if (tariffVersions.length === 0) break;
    try {
      const tariff = resolveTariffVersion(tariffVersions, `${date}T12:00`) as ScheduledTariffVersion;
      rangeImportCost += acc.actualImportCost;
      rangeExportCredit += acc.exportCredit;
      rangeSelfConsumedSolarValue += acc.selfConsumedSolarValue;
      rangeFixedCharges += fixedChargeContributionForDate(date, tariff.id, fixedCharges);
      rangeWithoutSolarImportCost += acc.withoutSolarImportCost;
    } catch {
      // Uncovered day — skip
    }
  }

  const hasBilling = tariffVersions.length > 0 && dayMap.size > 0;
  const actualGrossCost = r2(rangeImportCost + rangeFixedCharges);
  const actualNetCost = r2(actualGrossCost - rangeExportCredit);
  const withoutSolarGrossCost = r2(rangeWithoutSolarImportCost + rangeFixedCharges);
  const savings = r2(withoutSolarGrossCost - actualNetCost);
  const selfConsumptionRatio = totalConsumedKwh > 0
    ? r2((totalConsumedKwh - totalImportKwh) / totalConsumedKwh)
    : 0;
  const gridDependenceRatio = totalConsumedKwh > 0
    ? r2(totalImportKwh / totalConsumedKwh)
    : 0;

  const zeroCostBreakdown = { importCost: 0, fixedCharges: 0, exportCredit: 0, grossCost: 0, netCost: 0 };

  const summary: RangeSummarySection = {
    actual: hasBilling ? {
      importCost: r2(rangeImportCost),
      fixedCharges: r2(rangeFixedCharges),
      exportCredit: r2(rangeExportCredit),
      grossCost: actualGrossCost,
      netCost: actualNetCost,
    } : zeroCostBreakdown,
    withoutSolar: hasBilling ? {
      importCost: r2(rangeWithoutSolarImportCost),
      fixedCharges: r2(rangeFixedCharges),
      grossCost: withoutSolarGrossCost,
      netCost: withoutSolarGrossCost,
    } : { importCost: 0, fixedCharges: 0, grossCost: 0, netCost: 0 },
    solar: hasBilling ? {
      savings,
      exportValue: r2(rangeExportCredit),
      selfConsumedSolarValue: r2(rangeSelfConsumedSolarValue),
      selfConsumptionRatio,
      gridDependenceRatio,
    } : { savings: 0, exportValue: 0, selfConsumedSolarValue: 0, selfConsumptionRatio: 0, gridDependenceRatio: 0 },
    totals: {
      generatedKwh: r2(totalGeneratedKwh),
      importKwh: r2(totalImportKwh),
      exportKwh: r2(totalExportKwh),
      consumedKwh: r2(totalConsumedKwh),
      immersionDivertedKwh: r2(totalImmersionDivertedKwh),
    },
  };

  const health = deriveHealth(allDates, dayMap, tariffVersions, timezone);

  return { summary, series, health };
}
