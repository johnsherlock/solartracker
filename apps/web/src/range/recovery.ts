import type { RangeSeriesDay } from './types';

export type RepaymentSchedule = {
  additionDate: string;
  monthlyRepayment: number;
  repaymentDurationMonths: number;
};

export type RangeFinanceContext = {
  totalSystemInvestment: number;
  earliestAdditionDate: string;
  allTimeSavings: number;
  allTimeCoveredDays: number;
  repaymentSchedules: RepaymentSchedule[];
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

/**
 * Returns the total repayments that fall due within [from, to] (inclusive, YYYY-MM-DD).
 *
 * Each schedule's monthly payment is due on the same day-of-month as its additionDate,
 * for every month from month 0 through month (repaymentDurationMonths - 1).
 * Day-of-month is clamped to the actual last day of the month (e.g. Feb 28/29 for day 31).
 */
export function computeRepaymentsInRange(
  schedules: RepaymentSchedule[],
  from: string,
  to: string,
): number {
  let total = 0;
  for (const s of schedules) {
    const [sy, sm, sd] = s.additionDate.split('-').map(Number);
    for (let m = 0; m < s.repaymentDurationMonths; m++) {
      const payYear = sy + Math.floor((sm - 1 + m) / 12);
      const payMonth = ((sm - 1 + m) % 12) + 1;
      const daysInMonth = new Date(payYear, payMonth, 0).getDate();
      const payDay = Math.min(sd, daysInMonth);
      const payDate = `${payYear}-${String(payMonth).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`;
      if (payDate >= from && payDate <= to) {
        total += s.monthlyRepayment;
      }
    }
  }
  return Math.round(total * 100) / 100;
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
