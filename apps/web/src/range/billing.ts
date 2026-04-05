/**
 * Range-level billing composition from persisted daily summaries.
 *
 * Builds the full RangeSummaryPayload shape (minus meta) by:
 *  - calling calculateBillingFromDailySummaries for overall period totals
 *  - computing per-day billing for the series
 *  - detecting tariff version changes across the range
 *  - reporting missing-day completeness
 */

import {
  calculateBillingFromDailySummaries,
  resolveTariffVersion,
  type TariffVersion,
  type FixedChargeVersion,
  type DailySummaryForBilling,
} from '../domain/billing';
import type {
  RangeSummarySection,
  RangeSeriesDay,
  RangeSummaryHealth,
} from './types';
import type { DailySummaryRow } from './loader';

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
// Per-day series
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeDayBilling(
  row: DailySummaryRow,
  tariffVersions: TariffVersion[],
  fixedChargeVersions: FixedChargeVersion[],
): RangeSeriesDay['billing'] | null {
  try {
    const tariff = resolveTariffVersion(tariffVersions, `${row.localDate}T12:00`);
    const vat = 1 + (tariff.vatRate ?? 0);
    const discount = tariff.discountRuleType === 'percentage' && tariff.discountValue != null
      ? 1 - tariff.discountValue
      : 1;

    const actualImportCost = r2(row.importKwh * tariff.dayRate * discount * vat);
    const exportCredit = r2(row.exportKwh * (tariff.exportRate ?? 0));
    const actualNetCost = r2(actualImportCost - exportCredit);

    const withoutSolarImport = Math.max(
      0,
      row.importKwh + row.generatedKwh - row.exportKwh - (row.immersionDivertedKwh ?? 0),
    );
    const withoutSolarCost = r2(withoutSolarImport * tariff.dayRate * discount * vat);
    const savings = r2(withoutSolarCost - actualImportCost);

    return { actualNetCost, savings, exportCredit };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health derivation
// ---------------------------------------------------------------------------

function deriveHealth(
  allDates: string[],
  summaryMap: Map<string, DailySummaryRow>,
  tariffVersions: TariffVersion[],
): RangeSummaryHealth {
  const missingDayDates: string[] = [];
  let partialDays = 0;
  const applicableVersionIds = new Set<string>();
  const setupWarnings: string[] = [];
  const hasTariff = tariffVersions.length > 0;

  for (const date of allDates) {
    const row = summaryMap.get(date);

    if (!row) {
      missingDayDates.push(date);
      continue;
    }

    if (row.isPartial) {
      partialDays++;
    }

    if (hasTariff) {
      try {
        const version = resolveTariffVersion(tariffVersions, `${date}T12:00`);
        applicableVersionIds.add(version.id);
      } catch {
        // Day has no tariff coverage — note it but don't block
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
 * Compute the full range summary from persisted daily summary rows.
 *
 * @param rows           Daily summary rows for the requested range (any order)
 * @param allDates       All calendar dates in the range, inclusive (from allDatesInRange)
 * @param tariffVersions All tariff versions for the installation
 * @param fixedCharges   All fixed charge versions for the installation
 */
export function computeRangeSummary(
  rows: DailySummaryRow[],
  allDates: string[],
  tariffVersions: TariffVersion[],
  fixedCharges: FixedChargeVersion[],
): RangeComputeResult {
  const summaryMap = new Map(rows.map((r) => [r.localDate, r]));

  // Series — one entry per requested date (including missing days)
  const series: RangeSeriesDay[] = allDates.map((date) => {
    const row = summaryMap.get(date);
    if (!row) {
      return {
        date,
        generatedKwh: 0,
        importKwh: 0,
        exportKwh: 0,
        consumedKwh: null,
        immersionDivertedKwh: null,
        isPartial: false,
        billing: null,
      };
    }

    return {
      date,
      generatedKwh: row.generatedKwh,
      importKwh: row.importKwh,
      exportKwh: row.exportKwh,
      consumedKwh: row.consumedKwh,
      immersionDivertedKwh: row.immersionDivertedKwh,
      isPartial: row.isPartial,
      billing:
        tariffVersions.length > 0
          ? computeDayBilling(row, tariffVersions, fixedCharges)
          : null,
    };
  });

  // Overall billing — only over days that have summary rows
  const summariesForBilling: DailySummaryForBilling[] = rows.map((r) => ({
    localDate: r.localDate,
    importKwh: r.importKwh,
    exportKwh: r.exportKwh,
    generatedKwh: r.generatedKwh,
    consumedKwh: r.consumedKwh ?? 0,
    immersionDivertedKwh: r.immersionDivertedKwh ?? 0,
  }));

  const billing =
    tariffVersions.length > 0 && summariesForBilling.length > 0
      ? calculateBillingFromDailySummaries(summariesForBilling, tariffVersions, fixedCharges)
      : null;

  const zeroCostBreakdown = {
    importCost: 0,
    fixedCharges: 0,
    exportCredit: 0,
    grossCost: 0,
    netCost: 0,
  };

  const totalGeneratedKwh = rows.reduce((s, r) => s + r.generatedKwh, 0);
  const totalImportKwh = rows.reduce((s, r) => s + r.importKwh, 0);
  const totalExportKwh = rows.reduce((s, r) => s + r.exportKwh, 0);
  const totalConsumedKwh = rows.reduce((s, r) => s + (r.consumedKwh ?? 0), 0);
  const totalImmersionDivertedKwh = rows.reduce((s, r) => s + (r.immersionDivertedKwh ?? 0), 0);

  const summary: RangeSummarySection = {
    actual: billing?.actual ?? zeroCostBreakdown,
    withoutSolar: billing?.withoutSolar ?? { importCost: 0, fixedCharges: 0, grossCost: 0, netCost: 0 },
    solar: billing?.solar ?? { savings: 0, exportValue: 0, selfConsumptionRatio: 0, gridDependenceRatio: 0 },
    totals: {
      generatedKwh: r2(totalGeneratedKwh),
      importKwh: r2(totalImportKwh),
      exportKwh: r2(totalExportKwh),
      consumedKwh: r2(totalConsumedKwh),
      immersionDivertedKwh: r2(totalImmersionDivertedKwh),
    },
    note: 'simplified-daily-rate',
  };

  const health = deriveHealth(allDates, summaryMap, tariffVersions);

  return { summary, series, health };
}
