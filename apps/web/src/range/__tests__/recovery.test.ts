import { describe, it, expect } from 'vitest';
import { computeAllTimeSavings, computePayoffOutlook } from '../recovery';
import type { RangeFinanceContext } from '../recovery';
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

function makeContext(overrides: Partial<RangeFinanceContext> = {}): RangeFinanceContext {
  return {
    totalSystemInvestment: 10000,
    earliestAdditionDate: '2020-01-01',
    allTimeSavings: 2000,
    allTimeCoveredDays: 365,
    activeMonthlyRepayment: 150,
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

  it('works for upfront-only installations (no active repayment)', () => {
    const ctx = makeContext({ activeMonthlyRepayment: null });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });

  it('works for repayment-backed installations', () => {
    const ctx = makeContext({ activeMonthlyRepayment: 200 });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });

  it('works for mixed portfolio (multiple additions)', () => {
    // totalSystemInvestment already aggregated from multiple records
    const ctx = makeContext({
      totalSystemInvestment: 18000,
      allTimeSavings: 3000,
      allTimeCoveredDays: 400,
      activeMonthlyRepayment: 250,
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
    // 90 days synced, savings reasonable
    const ctx = makeContext({
      allTimeCoveredDays: 90,
      allTimeSavings: 450,
    });
    const result = computePayoffOutlook(ctx, '2025-01-01');
    expect(result).not.toBeNull();
  });
});
