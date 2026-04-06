/**
 * Payload types for the range-summary API (GET /api/range).
 */

export type RangeSummaryMeta = {
  from: string;         // YYYY-MM-DD, inclusive
  to: string;           // YYYY-MM-DD, inclusive
  timezone: string;
  currency: string;
  generatedAt: string;  // ISO 8601 timestamp
};

export type RangeCostBreakdown = {
  importCost: number;
  fixedCharges: number;
  exportCredit: number;
  grossCost: number;
  netCost: number;
};

export type RangeWithoutSolarBreakdown = {
  importCost: number;
  fixedCharges: number;
  grossCost: number;
  netCost: number;
};

export type RangeSolarSummary = {
  savings: number;
  exportValue: number;
  selfConsumptionRatio: number;
  gridDependenceRatio: number;
};

export type RangeEnergyTotals = {
  generatedKwh: number;
  importKwh: number;
  exportKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
};

export type RangeSummarySection = {
  actual: RangeCostBreakdown;
  withoutSolar: RangeWithoutSolarBreakdown;
  solar: RangeSolarSummary;
  totals: RangeEnergyTotals;
  /** Billing uses day rate for all import — time-of-use splitting is not possible from daily summaries. */
  note: 'simplified-daily-rate';
};

export type RangeSeriesDayBilling = {
  actualNetCost: number;
  savings: number;
  exportCredit: number;
};

export type RangeSeriesDay = {
  date: string;              // YYYY-MM-DD
  generatedKwh: number;
  importKwh: number;
  exportKwh: number;
  consumedKwh: number | null;
  immersionDivertedKwh: number | null;
  isPartial: boolean;
  /** null when no tariff version covers this day */
  billing: RangeSeriesDayBilling | null;
};

export type RangeSummaryHealth = {
  totalDays: number;
  coveredDays: number;
  missingDays: number;
  missingDayDates: string[];
  partialDays: number;
  /** 0–1: fraction of requested days that have a persisted summary */
  completenessRatio: number;
  hasTariffChange: boolean;
  /** Distinct tariff version IDs that apply over the range */
  tariffVersionIds: string[];
  hasTariff: boolean;
  /** Human-readable warnings about missing setup data */
  setupWarnings: string[];
};

export type RangeSummaryPayload = {
  meta: RangeSummaryMeta;
  summary: RangeSummarySection;
  series: RangeSeriesDay[];
  health: RangeSummaryHealth;
};
