import { describe, expect, it } from 'vitest';
import {
  buildFinanceSettingsPayload,
  deriveOutstandingBalance,
  deriveRemainingMonths,
  deriveTotalInvestment,
  elapsedMonths,
  validateFinanceInputs,
} from '../finance-domain';
import type { FinanceInputs } from '../finance-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = new Date('2026-04-25');

const upfrontOnly: FinanceInputs = {
  investmentDate: '2024-04-01',
  upfrontPayment: 8000,
  monthlyRepayment: null,
  repaymentDurationMonths: null,
};

const repaymentsOnly: FinanceInputs = {
  investmentDate: '2024-04-01',
  upfrontPayment: null,
  monthlyRepayment: 200,
  repaymentDurationMonths: 60,
};

const upfrontAndRepayments: FinanceInputs = {
  investmentDate: '2024-04-01',
  upfrontPayment: 2000,
  monthlyRepayment: 150,
  repaymentDurationMonths: 48,
};

// ---------------------------------------------------------------------------
// validateFinanceInputs
// ---------------------------------------------------------------------------

describe('validateFinanceInputs', () => {
  it('returns valid for upfront-only', () => {
    expect(validateFinanceInputs(upfrontOnly)).toEqual({ valid: true });
  });

  it('returns valid for repayments-only', () => {
    expect(validateFinanceInputs(repaymentsOnly)).toEqual({ valid: true });
  });

  it('returns valid for upfront + repayments', () => {
    expect(validateFinanceInputs(upfrontAndRepayments)).toEqual({ valid: true });
  });

  it('rejects missing investmentDate', () => {
    const result = validateFinanceInputs({ ...upfrontOnly, investmentDate: null });
    expect(result).toMatchObject({ valid: false });
  });

  it('rejects when neither upfront nor monthly repayment is supplied', () => {
    const result = validateFinanceInputs({
      investmentDate: '2024-04-01',
      upfrontPayment: null,
      monthlyRepayment: null,
      repaymentDurationMonths: null,
    });
    expect(result).toMatchObject({ valid: false });
  });

  it('rejects monthly repayment without duration', () => {
    const result = validateFinanceInputs({
      investmentDate: '2024-04-01',
      upfrontPayment: null,
      monthlyRepayment: 200,
      repaymentDurationMonths: null,
    });
    expect(result).toMatchObject({ valid: false });
  });
});

// ---------------------------------------------------------------------------
// deriveTotalInvestment
// ---------------------------------------------------------------------------

describe('deriveTotalInvestment', () => {
  it('upfront only', () => {
    expect(deriveTotalInvestment(upfrontOnly)).toBe(8000);
  });

  it('repayments only', () => {
    expect(deriveTotalInvestment(repaymentsOnly)).toBe(200 * 60); // 12000
  });

  it('upfront + repayments', () => {
    expect(deriveTotalInvestment(upfrontAndRepayments)).toBe(2000 + 150 * 48); // 9200
  });
});

// ---------------------------------------------------------------------------
// elapsedMonths
// ---------------------------------------------------------------------------

describe('elapsedMonths', () => {
  it('returns 0 for same month', () => {
    expect(elapsedMonths('2026-04-01', new Date('2026-04-25'))).toBe(0);
  });

  it('counts full months correctly', () => {
    // April 2024 → April 2026 = 24 months
    expect(elapsedMonths('2024-04-01', TODAY)).toBe(24);
  });

  it('never returns negative', () => {
    expect(elapsedMonths('2027-01-01', TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveRemainingMonths
// ---------------------------------------------------------------------------

describe('deriveRemainingMonths', () => {
  it('returns null when investmentDate is absent', () => {
    expect(deriveRemainingMonths({ ...repaymentsOnly, investmentDate: null }, TODAY)).toBeNull();
  });

  it('returns null when duration is absent', () => {
    expect(deriveRemainingMonths(upfrontOnly, TODAY)).toBeNull();
  });

  it('calculates remaining months correctly', () => {
    // 60-month term started April 2024, today is April 2026 → 24 elapsed, 36 remaining
    expect(deriveRemainingMonths(repaymentsOnly, TODAY)).toBe(36);
  });

  it('returns 0 when term is fully elapsed', () => {
    const elapsed: FinanceInputs = {
      investmentDate: '2020-01-01',
      upfrontPayment: null,
      monthlyRepayment: 200,
      repaymentDurationMonths: 12,
    };
    expect(deriveRemainingMonths(elapsed, TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveOutstandingBalance
// ---------------------------------------------------------------------------

describe('deriveOutstandingBalance', () => {
  it('returns null when no monthly repayment', () => {
    expect(deriveOutstandingBalance(upfrontOnly, TODAY)).toBeNull();
  });

  it('calculates outstanding balance correctly', () => {
    // 36 remaining months × €200 = €7200
    expect(deriveOutstandingBalance(repaymentsOnly, TODAY)).toBe(36 * 200);
  });

  it('returns 0 when term fully elapsed', () => {
    const done: FinanceInputs = {
      investmentDate: '2020-01-01',
      upfrontPayment: null,
      monthlyRepayment: 200,
      repaymentDurationMonths: 12,
    };
    expect(deriveOutstandingBalance(done, TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildFinanceSettingsPayload
// ---------------------------------------------------------------------------

describe('buildFinanceSettingsPayload', () => {
  it('returns configured: false when investmentDate is null', () => {
    const result = buildFinanceSettingsPayload({ ...upfrontOnly, investmentDate: null }, TODAY);
    expect(result).toEqual({ configured: false });
  });

  it('builds a complete payload for repayments-only', () => {
    const result = buildFinanceSettingsPayload(repaymentsOnly, TODAY);
    expect(result).toEqual({
      configured: true,
      investmentDate: '2024-04-01',
      upfrontPayment: null,
      monthlyRepayment: 200,
      repaymentDurationMonths: 60,
      totalInvestment: 12000,
      remainingMonths: 36,
      outstandingBalance: 7200,
    });
  });

  it('builds a complete payload for upfront-only (no repayment fields)', () => {
    const result = buildFinanceSettingsPayload(upfrontOnly, TODAY);
    expect(result).toMatchObject({
      configured: true,
      totalInvestment: 8000,
      remainingMonths: null,
      outstandingBalance: null,
    });
  });

  it('builds a complete payload for upfront + repayments', () => {
    const result = buildFinanceSettingsPayload(upfrontAndRepayments, TODAY);
    expect(result).toMatchObject({
      configured: true,
      totalInvestment: 9200,
    });
  });
});
