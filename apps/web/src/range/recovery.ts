import type { RangeSeriesDay } from './types';

export type RangeFinanceContext = {
  totalSystemInvestment: number;
  earliestAdditionDate: string;
  allTimeSavings: number;
  allTimeCoveredDays: number;
  activeMonthlyRepayment: number | null;
};

export type PayoffOutlook = {
  remainingInvestment: number;
  avgDailySavings: number;
  estimatedDaysRemaining: number;
  estimatedPayoffDate: string;
};

const MIN_DAYS_FOR_ESTIMATE = 30;

export function computeAllTimeSavings(series: RangeSeriesDay[]): {
  savings: number;
  coveredDays: number;
} {
  let savings = 0;
  let coveredDays = 0;
  for (const d of series) {
    if (!d.hasSummary || !d.billing) continue;
    savings += d.billing.savings;
    coveredDays++;
  }
  return { savings: Math.round(savings * 100) / 100, coveredDays };
}

export function computePayoffOutlook(
  ctx: RangeFinanceContext,
  today: string,
): PayoffOutlook | null {
  const remaining = ctx.totalSystemInvestment - ctx.allTimeSavings;
  if (remaining <= 0) return null;
  if (ctx.allTimeCoveredDays < MIN_DAYS_FOR_ESTIMATE) return null;

  const avgDailySavings = ctx.allTimeSavings / ctx.allTimeCoveredDays;
  if (avgDailySavings <= 0) return null;

  const estimatedDaysRemaining = Math.ceil(remaining / avgDailySavings);

  const payoffDate = new Date(`${today}T12:00:00`);
  payoffDate.setDate(payoffDate.getDate() + estimatedDaysRemaining);
  const estimatedPayoffDate = payoffDate.toISOString().slice(0, 10);

  return {
    remainingInvestment: Math.round(remaining * 100) / 100,
    avgDailySavings: Math.round(avgDailySavings * 100) / 100,
    estimatedDaysRemaining,
    estimatedPayoffDate,
  };
}
