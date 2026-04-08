/**
 * Client-side KPI aggregation from the loaded series data.
 *
 * Because the Range History screen uses a single 365-day fetch and adjusts
 * the visible window client-side, KPI totals must be recomputed from the
 * series whenever the active window changes.
 */

import type { RangeSeriesDay } from './types';

export type RangeKpis = {
  savings: number;
  actualNetCost: number;
  withoutSolarNetCost: number;
  actualExportCredit: number;
  /** Mean self-consumption ratio across covered days that have a value (0–1). */
  avgSelfConsumptionRatio: number | null;
  /** True when at least one day in the window has billing data. */
  hasTariff: boolean;
  /** Number of days in the window with no billing data. */
  tariffGapDays: number;
  /** Total days in the window with a persisted summary. */
  coveredDays: number;
  /** Days in the window with no summary at all. */
  missingDays: number;
  /** Days in the window marked as partial. */
  partialDays: number;
};

/**
 * Aggregates KPI totals from the series for days that fall within [from, to]
 * (both inclusive, YYYY-MM-DD strings).
 */
export function aggregateKpisFromSeries(
  series: RangeSeriesDay[],
  from: string,
  to: string,
): RangeKpis {
  const inWindow = series.filter((d) => d.date >= from && d.date <= to);

  let savings = 0;
  let actualNetCost = 0;
  let withoutSolarNetCost = 0;
  let actualExportCredit = 0;
  let selfConsumptionSum = 0;
  let selfConsumptionCount = 0;
  let hasTariff = false;
  let tariffGapDays = 0;
  let partialDays = 0;
  let coveredDays = 0;
  let missingDays = 0;

  for (const day of inWindow) {
    if (!day.hasSummary) {
      missingDays++;
      continue;
    }
    coveredDays++;
    if (day.isPartial) partialDays++;
    if (day.billing) {
      hasTariff = true;
      savings += day.billing.savings;
      actualNetCost += day.billing.actualNetCost;
      actualExportCredit += day.billing.exportCredit;
    } else {
      tariffGapDays++;
    }
  }

  // withoutSolarNetCost is not in per-day series — only available in the
  // server-computed summary block. For client-side windowing we approximate it
  // as actualNetCost + savings (savings = withoutSolar - actual).
  withoutSolarNetCost = actualNetCost + savings;

  // Self-consumption ratio: average over days that have generation data.
  // Not available per-day in the series — charts story will expose it.
  // For now return null so the KPI card can show a dash rather than 0.
  const avgSelfConsumptionRatio =
    selfConsumptionCount > 0 ? selfConsumptionSum / selfConsumptionCount : null;

  return {
    savings,
    actualNetCost,
    withoutSolarNetCost,
    actualExportCredit,
    avgSelfConsumptionRatio,
    hasTariff,
    tariffGapDays,
    coveredDays,
    missingDays,
    partialDays,
  };
}

/**
 * Generates the sorted list of all calendar dates between from and to inclusive.
 */
export function allDatesInWindow(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
