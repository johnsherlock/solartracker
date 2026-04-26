import { describe, expect, it } from 'vitest';
import {
  buildSystemAdditionRecord,
  buildSystemAdditionsPayload,
  deriveSystemAdditionOutstandingBalance,
  deriveSystemAdditionRemainingMonths,
  deriveSystemAdditionTotalInvestment,
  validateSystemAdditionInputs,
} from '../system-addition-domain';
import type { SystemAdditionInputs } from '../system-addition-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = new Date('2026-04-25');

const upfrontOnly: SystemAdditionInputs = {
  label: 'Original install',
  additionDate: '2024-04-01',
  capacityAddedKw: 6.5,
  upfrontPayment: 8000,
  monthlyRepayment: null,
  repaymentDurationMonths: null,
};

const repaymentsOnly: SystemAdditionInputs = {
  label: 'Battery addition',
  additionDate: '2024-04-01',
  capacityAddedKw: null,
  upfrontPayment: null,
  monthlyRepayment: 200,
  repaymentDurationMonths: 60,
};

const upfrontAndRepayments: SystemAdditionInputs = {
  label: 'Rear-roof expansion',
  additionDate: '2024-04-01',
  capacityAddedKw: 3.0,
  upfrontPayment: 2000,
  monthlyRepayment: 150,
  repaymentDurationMonths: 48,
};

// ---------------------------------------------------------------------------
// validateSystemAdditionInputs
// ---------------------------------------------------------------------------

describe('validateSystemAdditionInputs', () => {
  it('returns valid for upfront-only', () => {
    expect(validateSystemAdditionInputs(upfrontOnly)).toEqual({ valid: true });
  });

  it('returns valid for repayments-only', () => {
    expect(validateSystemAdditionInputs(repaymentsOnly)).toEqual({ valid: true });
  });

  it('returns valid for upfront + repayments', () => {
    expect(validateSystemAdditionInputs(upfrontAndRepayments)).toEqual({ valid: true });
  });

  it('rejects missing label', () => {
    expect(validateSystemAdditionInputs({ ...upfrontOnly, label: '' })).toMatchObject({
      valid: false,
    });
  });

  it('rejects whitespace-only label', () => {
    expect(validateSystemAdditionInputs({ ...upfrontOnly, label: '   ' })).toMatchObject({
      valid: false,
    });
  });

  it('rejects missing additionDate', () => {
    expect(validateSystemAdditionInputs({ ...upfrontOnly, additionDate: '' })).toMatchObject({
      valid: false,
    });
  });

  it('rejects when neither upfront nor monthly repayment is supplied', () => {
    expect(
      validateSystemAdditionInputs({
        ...upfrontOnly,
        upfrontPayment: null,
        monthlyRepayment: null,
      }),
    ).toMatchObject({ valid: false });
  });

  it('rejects monthly repayment without duration', () => {
    expect(
      validateSystemAdditionInputs({
        ...repaymentsOnly,
        repaymentDurationMonths: null,
      }),
    ).toMatchObject({ valid: false });
  });
});

// ---------------------------------------------------------------------------
// deriveSystemAdditionTotalInvestment
// ---------------------------------------------------------------------------

describe('deriveSystemAdditionTotalInvestment', () => {
  it('upfront only', () => {
    expect(deriveSystemAdditionTotalInvestment(upfrontOnly)).toBe(8000);
  });

  it('repayments only', () => {
    expect(deriveSystemAdditionTotalInvestment(repaymentsOnly)).toBe(200 * 60); // 12000
  });

  it('upfront + repayments', () => {
    expect(deriveSystemAdditionTotalInvestment(upfrontAndRepayments)).toBe(2000 + 150 * 48); // 9200
  });
});

// ---------------------------------------------------------------------------
// deriveSystemAdditionRemainingMonths
// ---------------------------------------------------------------------------

describe('deriveSystemAdditionRemainingMonths', () => {
  it('returns null when additionDate is absent', () => {
    expect(
      deriveSystemAdditionRemainingMonths({ ...repaymentsOnly, additionDate: '' }, TODAY),
    ).toBeNull();
  });

  it('returns null when duration is absent', () => {
    expect(deriveSystemAdditionRemainingMonths(upfrontOnly, TODAY)).toBeNull();
  });

  it('calculates remaining months correctly', () => {
    // 60-month term started April 2024, today is April 2026 → 24 elapsed, 36 remaining
    expect(deriveSystemAdditionRemainingMonths(repaymentsOnly, TODAY)).toBe(36);
  });

  it('returns 0 when term is fully elapsed', () => {
    const elapsed: SystemAdditionInputs = {
      ...repaymentsOnly,
      additionDate: '2020-01-01',
      repaymentDurationMonths: 12,
    };
    expect(deriveSystemAdditionRemainingMonths(elapsed, TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveSystemAdditionOutstandingBalance
// ---------------------------------------------------------------------------

describe('deriveSystemAdditionOutstandingBalance', () => {
  it('returns null when no monthly repayment', () => {
    expect(deriveSystemAdditionOutstandingBalance(upfrontOnly, TODAY)).toBeNull();
  });

  it('calculates outstanding balance correctly', () => {
    // 36 remaining months × €200 = €7200
    expect(deriveSystemAdditionOutstandingBalance(repaymentsOnly, TODAY)).toBe(36 * 200);
  });

  it('returns 0 when term fully elapsed', () => {
    const done: SystemAdditionInputs = {
      ...repaymentsOnly,
      additionDate: '2020-01-01',
      repaymentDurationMonths: 12,
    };
    expect(deriveSystemAdditionOutstandingBalance(done, TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildSystemAdditionRecord
// ---------------------------------------------------------------------------

describe('buildSystemAdditionRecord', () => {
  it('builds a complete record for repayments-only', () => {
    const record = buildSystemAdditionRecord('id-1', repaymentsOnly, TODAY);
    expect(record).toEqual({
      id: 'id-1',
      label: 'Battery addition',
      additionDate: '2024-04-01',
      capacityAddedKw: null,
      upfrontPayment: null,
      monthlyRepayment: 200,
      repaymentDurationMonths: 60,
      totalInvestment: 12000,
      remainingMonths: 36,
      outstandingBalance: 7200,
    });
  });

  it('builds a correct record for upfront-only', () => {
    const record = buildSystemAdditionRecord('id-2', upfrontOnly, TODAY);
    expect(record).toMatchObject({
      totalInvestment: 8000,
      remainingMonths: null,
      outstandingBalance: null,
    });
  });

  it('builds a correct record for upfront + repayments', () => {
    const record = buildSystemAdditionRecord('id-3', upfrontAndRepayments, TODAY);
    expect(record).toMatchObject({
      totalInvestment: 9200,
    });
  });
});

// ---------------------------------------------------------------------------
// buildSystemAdditionsPayload
// ---------------------------------------------------------------------------

describe('buildSystemAdditionsPayload', () => {
  it('returns configured: false for empty list', () => {
    expect(buildSystemAdditionsPayload([], TODAY)).toEqual({ configured: false });
  });

  it('returns configured: true with one record', () => {
    const payload = buildSystemAdditionsPayload(
      [{ id: 'id-1', ...upfrontOnly }],
      TODAY,
    );
    expect(payload).toMatchObject({ configured: true });
    if (payload.configured) {
      expect(payload.records).toHaveLength(1);
    }
  });

  it('returns all records for multi-record installation', () => {
    const payload = buildSystemAdditionsPayload(
      [
        { id: 'id-1', ...upfrontOnly },
        { id: 'id-2', ...repaymentsOnly },
        { id: 'id-3', ...upfrontAndRepayments },
      ],
      TODAY,
    );
    expect(payload).toMatchObject({ configured: true });
    if (payload.configured) {
      expect(payload.records).toHaveLength(3);
    }
  });

  it('returns configured: false when all rows are invalid', () => {
    const invalidRow = {
      id: 'id-bad',
      label: 'No finance',
      additionDate: '2024-04-01',
      capacityAddedKw: 4.0,
      upfrontPayment: null,
      monthlyRepayment: null,
      repaymentDurationMonths: null,
    };
    expect(buildSystemAdditionsPayload([invalidRow], TODAY)).toEqual({ configured: false });
  });

  it('excludes invalid rows from a mixed list', () => {
    const invalidRow = {
      id: 'id-bad',
      label: 'No finance',
      additionDate: '2024-04-01',
      capacityAddedKw: null,
      upfrontPayment: null,
      monthlyRepayment: null,
      repaymentDurationMonths: null,
    };
    const payload = buildSystemAdditionsPayload(
      [invalidRow, { id: 'id-1', ...upfrontOnly }],
      TODAY,
    );
    expect(payload).toMatchObject({ configured: true });
    if (payload.configured) {
      expect(payload.records).toHaveLength(1);
      expect(payload.records[0].id).toBe('id-1');
    }
  });

  it('derives totals independently per record', () => {
    const payload = buildSystemAdditionsPayload(
      [
        { id: 'id-1', ...upfrontOnly },       // totalInvestment = 8000
        { id: 'id-2', ...repaymentsOnly },    // totalInvestment = 12000
      ],
      TODAY,
    );
    if (payload.configured) {
      expect(payload.records[0].totalInvestment).toBe(8000);
      expect(payload.records[1].totalInvestment).toBe(12000);
    }
  });
});
