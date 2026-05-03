/**
 * Client-side KPI aggregation from the loaded series data.
 *
 * Because the Range History screen uses a single 365-day fetch and adjusts
 * the visible window client-side, KPI totals must be recomputed from the
 * series whenever the active window changes.
 */

import type { RangeSeriesDay } from './types';

export type RangeKpis = {
  // --- U-054 energy value metrics ---
  /** Self-consumed solar kWh priced at the applicable import rate. */
  selfConsumedSolarValue: number;
  /** selfConsumedSolarValue + exportCredit */
  totalSolarValue: number;
  actualExportCredit: number;

  // --- U-054 bill impact metrics ---
  /** Tariff-priced cost of imported electricity (before export credit). */
  importBill: number;
  /** importBill − exportCredit */
  netEnergyBill: number;
  /** Modelled counterfactual import bill without solar. */
  withoutSolarNetCost: number;
  /** withoutSolarNetCost − actualNetCost — comparable full-bill bases, labelled as estimated. */
  billReductionFromSolar: number;

  // --- retained for investment panel and legacy chart use ---
  /** Bill reduction = totalSolarValue numerically; retained for investment recovery calc. */
  savings: number;
  actualNetCost: number;

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
  let actualExportCredit = 0;
  let selfConsumedSolarValue = 0;
  let importBill = 0;
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
      selfConsumedSolarValue += day.billing.selfConsumedSolarValue;
      importBill += day.billing.importCost;
    } else {
      tariffGapDays++;
    }
    if (day.consumedKwh && day.consumedKwh > 0) {
      const selfConsumed = day.generatedKwh - day.exportKwh;
      selfConsumptionSum += Math.min(1, Math.max(0, selfConsumed / day.consumedKwh));
      selfConsumptionCount++;
    }
  }

  // withoutSolarNetCost is not in per-day series — only available in the
  // server-computed summary block. For client-side windowing we approximate it
  // as actualNetCost + savings (savings = withoutSolar - actual).
  const withoutSolarNetCost = actualNetCost + savings;
  const totalSolarValue = Math.round((selfConsumedSolarValue + actualExportCredit) * 100) / 100;
  const netEnergyBill = Math.round((importBill - actualExportCredit) * 100) / 100;
  const billReductionFromSolar = Math.round((withoutSolarNetCost - actualNetCost) * 100) / 100;

  const avgSelfConsumptionRatio =
    selfConsumptionCount > 0 ? selfConsumptionSum / selfConsumptionCount : null;

  return {
    selfConsumedSolarValue: Math.round(selfConsumedSolarValue * 100) / 100,
    totalSolarValue,
    actualExportCredit: Math.round(actualExportCredit * 100) / 100,
    importBill: Math.round(importBill * 100) / 100,
    netEnergyBill,
    withoutSolarNetCost: Math.round(withoutSolarNetCost * 100) / 100,
    billReductionFromSolar,
    savings: Math.round(savings * 100) / 100,
    actualNetCost: Math.round(actualNetCost * 100) / 100,
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
