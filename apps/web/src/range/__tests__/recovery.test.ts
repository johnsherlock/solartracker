import { describe, it, expect } from 'vitest';
import { computeAllTimeSavings, computePayoffOutlook, computeRepaymentsInRange } from '../recovery';
import type { RangeFinanceContext, RepaymentSchedule } from '../recovery';
import type { RangeSeriesDay } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDay(date: string, savings: number): RangeSeriesDay {
  return {
    date,
    hasSummary: true,
    generatedKwh: 0,
    importKwh: 0,
    exportKwh: 0,
    consumedKwh: null,
    immersionDivertedKwh: null,
    isPartial: false,
    billing: {
      importCost: 0,
      exportCredit: 0,
      fixedCharges: 0,
      savings,
      actualNetCost: 0,
    },
    tariffVersionId: 'v1',
    dayImportKwh: null,
    nightImportKwh: null,
    peakImportKwh: null,
  };
}

function makeMissingDay(date: string): RangeSeriesDay {
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

function makeSchedule(overrides: Partial<RepaymentSchedule> = {}): RepaymentSchedule {
  return {
    additionDate: '2020-01-01',
    monthlyRepayment: 150,
    repaymentDurationMonths: 60,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RangeFinanceContext> = {}): RangeFinanceContext {
  return {
    totalSystemInvestment: 10000,
    earliestAdditionDate: '2020-01-01',
    allTimeSavings: 2000,
    allTimeCoveredDays: 365,
    repaymentSchedules: [makeSchedule()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeAllTimeSavings
// ---------------------------------------------------------------------------

describe('computeAllTimeSavings', () => {
  it('returns zero for an empty series', () => {
    expect(computeAllTimeSavings([])).toEqual({ savings: 0, coveredDays: 0 });
  });

  it('sums savings only from days with billing data', () => {
    const series = [
      makeDay('2024-01-01', 1.50),
      makeDay('2024-01-02', 2.25),
      makeMissingDay('2024-01-03'),
    ];
    const result = computeAllTimeSavings(series);
    expect(result.savings).toBe(3.75);
    expect(result.coveredDays).toBe(2);
  });

  it('excludes days with hasSummary=true but null billing', () => {
    const day: RangeSeriesDay = {
      ...makeDay('2024-01-01', 0),
      billing: null,
    };
    expect(computeAllTimeSavings([day])).toEqual({ savings: 0, coveredDays: 0 });
  });

  it('handles single-record installation', () => {
    const series = [makeDay('2024-06-01', 3.00)];
    expect(computeAllTimeSavings(series)).toEqual({ savings: 3, coveredDays: 1 });
  });

  it('rounds savings to 2 decimal places', () => {
    const series = [
      makeDay('2024-01-01', 1.005),
      makeDay('2024-01-02', 1.005),
    ];
    const { savings } = computeAllTimeSavings(series);
    // 2.01 after rounding
    expect(savings).toBe(2.01);
  });
});

// ---------------------------------------------------------------------------
// computePayoffOutlook
// ---------------------------------------------------------------------------

describe('computePayoffOutlook', () => {
  it('returns null when already paid off', () => {
    const ctx = makeContext({ allTimeSavings: 10000, totalSystemInvestment: 10000 });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns null when savings exceed investment', () => {
    const ctx = makeContext({ allTimeSavings: 12000, totalSystemInvestment: 10000 });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns null when covered days < 30 (insufficient history)', () => {
    const ctx = makeContext({ allTimeCoveredDays: 29 });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns null at exactly 0 covered days (upfront-only with no data)', () => {
    const ctx = makeContext({ allTimeCoveredDays: 0, allTimeSavings: 0 });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns null when average daily savings is zero or negative', () => {
    const ctx = makeContext({ allTimeSavings: 0, allTimeCoveredDays: 365 });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns a valid outlook when history is sufficient', () => {
    // 2000 saved over 365 days = ~5.48/day; 8000 remaining → ~1460 days
    const ctx = makeContext();
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
    expect(result!.remainingInvestment).toBe(8000);
    expect(result!.avgDailySavings).toBeCloseTo(5.48, 1);
    expect(result!.estimatedDaysRemaining).toBeGreaterThan(0);
    expect(result!.estimatedPayoffDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns an outlook at exactly 30 covered days (minimum threshold)', () => {
    const ctx = makeContext({ allTimeCoveredDays: 30, allTimeSavings: 150 });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });

  it('estimated payoff date is in the future', () => {
    const today = '2025-01-01';
    const ctx = makeContext();
    const result = computePayoffOutlook(ctx, today);
    expect(result!.estimatedPayoffDate > today).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Financing model variants
  // ---------------------------------------------------------------------------

  it('works for upfront-only installations (no repayment schedules)', () => {
    const ctx = makeContext({ repaymentSchedules: [] });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });

  it('works for repayment-backed installations', () => {
    const ctx = makeContext({ repaymentSchedules: [makeSchedule({ monthlyRepayment: 200 })] });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });

  it('works for mixed portfolio (multiple additions)', () => {
    const ctx = makeContext({
      totalSystemInvestment: 18000,
      allTimeSavings: 3000,
      allTimeCoveredDays: 400,
      repaymentSchedules: [
        makeSchedule({ monthlyRepayment: 150 }),
        makeSchedule({ additionDate: '2022-06-01', monthlyRepayment: 100, repaymentDurationMonths: 36 }),
      ],
    });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
    expect(result!.remainingInvestment).toBe(15000);
  });

  // ---------------------------------------------------------------------------
  // Partial-history scenario
  // ---------------------------------------------------------------------------

  it('returns null for partial-history installations with < 30 covered days', () => {
    // User has a 3-year-old installation but only 2 weeks of synced history
    const ctx = makeContext({
      allTimeCoveredDays: 14,
      allTimeSavings: 100,
    });
    expect(computePayoffOutlook(ctx, '2025-01-01')).toBeNull();
  });

  it('returns an estimate for partial-history with enough covered days', () => {
    const ctx = makeContext({
      allTimeCoveredDays: 90,
      allTimeSavings: 450,
    });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeRepaymentsInRange
// ---------------------------------------------------------------------------

describe('computeRepaymentsInRange', () => {
  it('returns 0 for an empty schedule list', () => {
    expect(computeRepaymentsInRange([], '2024-01-01', '2024-12-31')).toBe(0);
  });

  it('counts a single payment falling within the range', () => {
    const s = makeSchedule({ additionDate: '2024-01-15', monthlyRepayment: 100, repaymentDurationMonths: 12 });
    // Payment on 2024-04-15 should be in range Apr 1–Apr 30
    expect(computeRepaymentsInRange([s], '2024-04-01', '2024-04-30')).toBe(100);
  });

  it('counts multiple payments within a wide range', () => {
    const s = makeSchedule({ additionDate: '2024-01-01', monthlyRepayment: 150, repaymentDurationMonths: 6 });
    // Payments on 2024-01 through 2024-06 — range covers all 6
    expect(computeRepaymentsInRange([s], '2024-01-01', '2024-06-30')).toBe(900);
  });

  it('excludes payments that fall outside the schedule duration', () => {
    const s = makeSchedule({ additionDate: '2024-01-01', monthlyRepayment: 100, repaymentDurationMonths: 3 });
    // Only Jan, Feb, Mar payments exist; range extends to Dec
    expect(computeRepaymentsInRange([s], '2024-01-01', '2024-12-31')).toBe(300);
  });

  it('excludes payments before the range start', () => {
    const s = makeSchedule({ additionDate: '2024-01-01', monthlyRepayment: 100, repaymentDurationMonths: 12 });
    expect(computeRepaymentsInRange([s], '2024-06-01', '2024-12-31')).toBe(700);
  });

  it('sums payments across multiple schedules', () => {
    const s1 = makeSchedule({ additionDate: '2024-01-01', monthlyRepayment: 100, repaymentDurationMonths: 12 });
    const s2 = makeSchedule({ additionDate: '2024-03-01', monthlyRepayment: 200, repaymentDurationMonths: 6 });
    // In May: s1 pays 100 (2024-05-01), s2 pays 200 (2024-05-01)
    expect(computeRepaymentsInRange([s1, s2], '2024-05-01', '2024-05-31')).toBe(300);
  });

  it('handles upfront-only portfolio (no schedules) returning 0', () => {
    expect(computeRepaymentsInRange([], '2024-01-01', '2024-12-31')).toBe(0);
  });

  it('clamps day-of-month to end of month (e.g. Jan 31 → Feb 28)', () => {
    const s = makeSchedule({ additionDate: '2024-01-31', monthlyRepayment: 100, repaymentDurationMonths: 3 });
    // Feb payment falls on 2024-02-29 (2024 is a leap year)
    expect(computeRepaymentsInRange([s], '2024-02-29', '2024-02-29')).toBe(100);
    // Mar payment falls on 2024-03-31
    expect(computeRepaymentsInRange([s], '2024-03-31', '2024-03-31')).toBe(100);
  });

  it('returns 0 for a period entirely before any payments are due', () => {
    const s = makeSchedule({ additionDate: '2025-01-01', monthlyRepayment: 100, repaymentDurationMonths: 12 });
    expect(computeRepaymentsInRange([s], '2024-01-01', '2024-12-31')).toBe(0);
  });

  // Selected-period variants matching story acceptance criteria
  it('handles a single-month range correctly', () => {
    const s = makeSchedule({ additionDate: '2024-04-01', monthlyRepayment: 158.33, repaymentDurationMonths: 60 });
    expect(computeRepaymentsInRange([s], '2024-04-01', '2024-04-30')).toBeCloseTo(158.33, 2);
  });

  it('handles a calendar-year range correctly', () => {
    const s = makeSchedule({ additionDate: '2024-01-01', monthlyRepayment: 100, repaymentDurationMonths: 24 });
    // 12 payments in 2024
    expect(computeRepaymentsInRange([s], '2024-01-01', '2024-12-31')).toBe(1200);
  });

  it('handles a custom range spanning two months with one payment per month', () => {
    const s = makeSchedule({ additionDate: '2024-01-15', monthlyRepayment: 100, repaymentDurationMonths: 12 });
    // Range Apr 10–May 20: payment on Apr 15 and May 15 both in range
    expect(computeRepaymentsInRange([s], '2024-04-10', '2024-05-20')).toBe(200);
  });
});
