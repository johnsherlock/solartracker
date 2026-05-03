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

export type PayoffOutlook =
  | {
      status: 'in_progress';
      remainingInvestment: number;
      avgDailySavings: number;
      observedDays: number;
      basisDate: string;
      estimatedDaysRemaining: number;
      estimatedPayoffDate: string;
    }
  | {
      status: 'recovered';
      avgDailySavings: number;
      observedDays: number;
      basisDate: string;
      estimatedDaysSinceRecovery: number;
      estimatedRecoveredDate: string;
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

/**
 * Returns repayments for the period.
 *
 * When `calendarAligned` is true (user picked a whole month or year), the exact
 * payment-date count is used — the payment date will naturally fall inside the window.
 *
 * For all other range types (weeks, custom, etc.) a daily-rate pro-rata is used:
 *   dailyRate = monthlyRepayment × 12 / 365
 *   amount    = dailyRate × periodDays
 *
 * Only schedules active during the period are included.
 * Returns `isProRata: true` so the UI can label the value as an estimate.
 */
export function computeRepaymentsForPeriod(
  schedules: RepaymentSchedule[],
  from: string,
  to: string,
  calendarAligned: boolean,
): { amount: number; isProRata: boolean } {
  if (calendarAligned) {
    return { amount: computeRepaymentsInRange(schedules, from, to), isProRata: false };
  }

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const periodDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  let monthlyTotal = 0;
  for (const s of schedules) {
    const [sy, sm, sd] = s.additionDate.split('-').map(Number);
    const scheduleStart = new Date(sy, sm - 1, sd);
    const lastM = sm - 1 + s.repaymentDurationMonths - 1;
    const endYear = sy + Math.floor(lastM / 12);
    const endMonth = lastM % 12;
    const daysInEndMonth = new Date(endYear, endMonth + 1, 0).getDate();
    const scheduleEnd = new Date(endYear, endMonth, Math.min(sd, daysInEndMonth));
    if (scheduleStart <= toDate && scheduleEnd >= fromDate) {
      monthlyTotal += s.monthlyRepayment;
    }
  }

  const proRata = Math.round((monthlyTotal * 12 / 365 * periodDays) * 100) / 100;
  return { amount: proRata, isProRata: proRata > 0 };
}

export function computePayoffOutlook(
  ctx: RangeFinanceContext,
  basisDate: string,
): PayoffOutlook | null {
  if (ctx.allTimeCoveredDays < MIN_DAYS_FOR_ESTIMATE) return null;

  const avgDailySavings = ctx.allTimeSavings / ctx.allTimeCoveredDays;
  if (avgDailySavings <= 0) return null;

  const remaining = ctx.totalSystemInvestment - ctx.allTimeSavings;
  if (remaining <= 0) {
    const estimatedDaysSinceRecovery = Math.max(
      0,
      Math.floor((ctx.allTimeSavings - ctx.totalSystemInvestment) / avgDailySavings),
    );
    const recoveredDate = new Date(`${basisDate}T12:00:00`);
    recoveredDate.setDate(recoveredDate.getDate() - estimatedDaysSinceRecovery);

    return {
      status: 'recovered',
      avgDailySavings: Math.round(avgDailySavings * 100) / 100,
      observedDays: ctx.allTimeCoveredDays,
      basisDate,
      estimatedDaysSinceRecovery,
      estimatedRecoveredDate: recoveredDate.toISOString().slice(0, 10),
    };
  }

  const estimatedDaysRemaining = Math.ceil(remaining / avgDailySavings);

  const payoffDate = new Date(`${basisDate}T12:00:00`);
  payoffDate.setDate(payoffDate.getDate() + estimatedDaysRemaining);
  const estimatedPayoffDate = payoffDate.toISOString().slice(0, 10);

  return {
    status: 'in_progress',
    remainingInvestment: Math.round(remaining * 100) / 100,
    avgDailySavings: Math.round(avgDailySavings * 100) / 100,
    observedDays: ctx.allTimeCoveredDays,
    basisDate,
    estimatedDaysRemaining,
    estimatedPayoffDate,
  };
}
