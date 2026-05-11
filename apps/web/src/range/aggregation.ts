import type { RangeSeriesDay, RangeSeriesDayBilling } from './types';

export type RangeGroupBy = 'day' | 'week' | 'month';

export function getAvailableRangeGroupings(dayCount: number): RangeGroupBy[] {
  if (dayCount > 180) return ['day', 'week', 'month'];
  if (dayCount > 60) return ['day', 'week'];
  return ['day'];
}

export function getDefaultRangeGrouping(dayCount: number): RangeGroupBy {
  if (dayCount > 180) return 'month';
  if (dayCount > 60) return 'week';
  return 'day';
}

export function formatRangeGroupingLabel(groupBy: RangeGroupBy): string {
  if (groupBy === 'day') return 'Day';
  if (groupBy === 'week') return 'Week';
  return 'Month';
}

export function describeRangeGrouping(groupBy: RangeGroupBy): string {
  if (groupBy === 'day') return 'daily';
  if (groupBy === 'week') return 'weekly';
  return 'monthly';
}

export function formatRangeGroupingNoun(groupBy: RangeGroupBy): string {
  if (groupBy === 'day') return 'day';
  if (groupBy === 'week') return 'week';
  return 'month';
}

export function aggregateRangeSeries(
  series: RangeSeriesDay[],
  groupBy: RangeGroupBy,
): RangeSeriesDay[] {
  if (groupBy === 'day') return series;

  const buckets = new Map<string, RangeSeriesDay[]>();

  for (const day of series) {
    const key = groupBy === 'week' ? startOfIsoWeek(day.date) : startOfMonth(day.date);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(day);
    } else {
      buckets.set(key, [day]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, days]) => aggregateBucket(date, days));
}

function aggregateBucket(date: string, days: RangeSeriesDay[]): RangeSeriesDay {
  const summaryDays = days.filter((day) => day.hasSummary);
  const billedDays = summaryDays.filter((day) => day.billing != null);
  const tariffVersionIds = new Set(
    days.map((day) => day.tariffVersionId).filter((value): value is string => value != null),
  );

  return {
    date,
    hasSummary: summaryDays.length > 0,
    generatedKwh: round6(sum(summaryDays.map((day) => day.generatedKwh))),
    importKwh: round6(sum(summaryDays.map((day) => day.importKwh))),
    exportKwh: round6(sum(summaryDays.map((day) => day.exportKwh))),
    consumedKwh: nullableSum(summaryDays.map((day) => day.consumedKwh)),
    immersionDivertedKwh: nullableSum(summaryDays.map((day) => day.immersionDivertedKwh)),
    isPartial:
      days.some((day) => !day.hasSummary) || days.some((day) => day.isPartial),
    billing: billedDays.length > 0 ? aggregateBilling(billedDays) : null,
    tariffVersionId: tariffVersionIds.size === 1 ? [...tariffVersionIds][0] : null,
    dayImportKwh: nullableSum(summaryDays.map((day) => day.dayImportKwh)),
    nightImportKwh: nullableSum(summaryDays.map((day) => day.nightImportKwh)),
    peakImportKwh: nullableSum(summaryDays.map((day) => day.peakImportKwh)),
  };
}

function aggregateBilling(days: RangeSeriesDay[]): RangeSeriesDayBilling {
  return {
    actualNetCost: round2(
      sum(days.map((day) => day.billing?.actualNetCost ?? 0)),
    ),
    savings: round2(sum(days.map((day) => day.billing?.savings ?? 0))),
    exportCredit: round2(sum(days.map((day) => day.billing?.exportCredit ?? 0))),
    importCost: round2(sum(days.map((day) => day.billing?.importCost ?? 0))),
    fixedCharges: round2(sum(days.map((day) => day.billing?.fixedCharges ?? 0))),
    selfConsumedSolarValue: round2(
      sum(days.map((day) => day.billing?.selfConsumedSolarValue ?? 0)),
    ),
    freeImportKwh: round6(sum(days.map((day) => day.billing?.freeImportKwh ?? 0))),
  };
}

function nullableSum(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value != null);
  if (numeric.length === 0) return null;
  return round6(sum(numeric));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function startOfIsoWeek(date: string): string {
  const utcDate = new Date(`${date}T12:00:00Z`);
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - (day - 1));
  return utcDate.toISOString().slice(0, 10);
}
