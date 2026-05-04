import { describe, it, expect } from 'vitest';
import type { RangeSeriesDay } from '../../range/types';
import type { RepaymentSchedule } from '../../range/recovery';
import {
  extractDayValue,
  normalizeSeries,
  formatDayValue,
  getDailyRepayment,
  findBestDates,
} from '../metrics';
import type { NormalizedDay } from '../metrics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDay(overrides: Partial<RangeSeriesDay> = {}): RangeSeriesDay {
  return {
    date: '2025-06-15',
    hasSummary: true,
    generatedKwh: 10,
    importKwh: 5,
    exportKwh: 3,
    consumedKwh: 12,
    immersionDivertedKwh: 2,
    isPartial: false,
    billing: {
      actualNetCost: 1.5,
      savings: 2.0,
      exportCredit: 0.9,
      importCost: 2.4,
      fixedCharges: 0.5,
      selfConsumedSolarValue: 1.1,
      freeImportKwh: 0,
    },
    tariffVersionId: 'v1',
    dayImportKwh: 2,
    nightImportKwh: 3,
    peakImportKwh: null,
    ...overrides,
  };
}

const noSchedules: RepaymentSchedule[] = [];

const activeSchedule: RepaymentSchedule = {
  additionDate: '2024-01-01',
  monthlyRepayment: 100,
  repaymentDurationMonths: 120,
};

// ---------------------------------------------------------------------------
// extractDayValue
// ---------------------------------------------------------------------------

describe('extractDayValue', () => {
  it('returns null for a missing day', () => {
    const day = makeDay({ hasSummary: false });
    expect(extractDayValue(day, 'generation_kwh', noSchedules)).toBeNull();
  });

  it('generation_kwh returns generatedKwh', () => {
    expect(extractDayValue(makeDay(), 'generation_kwh', noSchedules)).toBe(10);
  });

  it('self_consumed_kwh returns generatedKwh - exportKwh', () => {
    expect(extractDayValue(makeDay(), 'self_consumed_kwh', noSchedules)).toBe(7);
  });

  it('self_consumed_kwh clamps to 0 when export > generation', () => {
    const day = makeDay({ generatedKwh: 1, exportKwh: 3 });
    expect(extractDayValue(day, 'self_consumed_kwh', noSchedules)).toBe(0);
  });

  it('self_consumed_value returns billing.selfConsumedSolarValue', () => {
    expect(extractDayValue(makeDay(), 'self_consumed_value', noSchedules)).toBe(1.1);
  });

  it('self_consumed_value returns null when no billing', () => {
    const day = makeDay({ billing: null });
    expect(extractDayValue(day, 'self_consumed_value', noSchedules)).toBeNull();
  });

  it('import_kwh returns importKwh', () => {
    expect(extractDayValue(makeDay(), 'import_kwh', noSchedules)).toBe(5);
  });

  it('import_cost returns billing.importCost', () => {
    expect(extractDayValue(makeDay(), 'import_cost', noSchedules)).toBeCloseTo(2.4);
  });

  it('export_kwh returns exportKwh', () => {
    expect(extractDayValue(makeDay(), 'export_kwh', noSchedules)).toBe(3);
  });

  it('immersion_kwh returns immersionDivertedKwh', () => {
    expect(extractDayValue(makeDay(), 'immersion_kwh', noSchedules)).toBe(2);
  });

  it('immersion_kwh returns null when null on day', () => {
    const day = makeDay({ immersionDivertedKwh: null });
    expect(extractDayValue(day, 'immersion_kwh', noSchedules)).toBeNull();
  });

  it('solar_coverage returns selfConsumed / consumedKwh', () => {
    // selfConsumed = 10 - 3 = 7; consumed = 12 → 7/12 ≈ 0.583
    const value = extractDayValue(makeDay(), 'solar_coverage', noSchedules);
    expect(value).toBeCloseTo(7 / 12, 3);
  });

  it('solar_coverage clamps selfConsumed to 0 when export > generation', () => {
    const day = makeDay({ generatedKwh: 1, exportKwh: 3, consumedKwh: 10 });
    expect(extractDayValue(day, 'solar_coverage', noSchedules)).toBe(0);
  });

  it('solar_coverage returns null when consumedKwh is 0', () => {
    const day = makeDay({ consumedKwh: 0 });
    expect(extractDayValue(day, 'solar_coverage', noSchedules)).toBeNull();
  });

  it('net_solar_position returns billing.savings', () => {
    expect(extractDayValue(makeDay(), 'net_solar_position', noSchedules)).toBe(2.0);
  });

  it('net_solar_position returns null when no billing', () => {
    const day = makeDay({ billing: null });
    expect(extractDayValue(day, 'net_solar_position', noSchedules)).toBeNull();
  });

  it('prorata_coverage returns null when no billing', () => {
    const day = makeDay({ billing: null });
    expect(extractDayValue(day, 'prorata_coverage', [activeSchedule])).toBeNull();
  });

  it('prorata_coverage returns null when no schedules', () => {
    expect(extractDayValue(makeDay(), 'prorata_coverage', noSchedules)).toBeNull();
  });

  it('prorata_coverage returns fraction of daily repayment covered', () => {
    // dailyRepayment = 100 * 12 / 365 ≈ 3.2877
    // savings = 2.0 → coverage = 2.0 / 3.2877 ≈ 0.608
    const value = extractDayValue(makeDay(), 'prorata_coverage', [activeSchedule]);
    expect(value).not.toBeNull();
    expect(value!).toBeCloseTo(2.0 / (100 * 12 / 365), 3);
  });

  it('prorata_coverage can exceed 1.0 when savings > daily repayment', () => {
    const richDay = makeDay({ billing: { ...makeDay().billing!, savings: 10 } });
    const value = extractDayValue(richDay, 'prorata_coverage', [activeSchedule]);
    expect(value!).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeSeries
// ---------------------------------------------------------------------------

describe('normalizeSeries', () => {
  it('peak day gets normalizedHeight of 1', () => {
    const days = [
      makeDay({ date: '2025-01-01', generatedKwh: 10 }),
      makeDay({ date: '2025-01-02', generatedKwh: 5 }),
      makeDay({ date: '2025-01-03', generatedKwh: 2 }),
    ];
    const result = normalizeSeries(days, 'generation_kwh', noSchedules);
    expect(result[0].normalizedHeight).toBe(1);
    expect(result[1].normalizedHeight).toBeCloseTo(0.5);
    expect(result[2].normalizedHeight).toBeCloseTo(0.2);
  });

  it('missing day has normalizedHeight of null', () => {
    const days = [
      makeDay({ date: '2025-01-01', generatedKwh: 10 }),
      makeDay({ date: '2025-01-02', hasSummary: false }),
    ];
    const result = normalizeSeries(days, 'generation_kwh', noSchedules);
    expect(result[1].normalizedHeight).toBeNull();
  });

  it('all-zero series yields normalizedHeight of 0 for all covered days', () => {
    const days = [
      makeDay({ date: '2025-01-01', generatedKwh: 0 }),
      makeDay({ date: '2025-01-02', generatedKwh: 0 }),
    ];
    const result = normalizeSeries(days, 'generation_kwh', noSchedules);
    expect(result[0].normalizedHeight).toBe(0);
    expect(result[1].normalizedHeight).toBe(0);
  });

  it('solar_coverage uses absolute bars (peak = 1.0) so 60% day shows 0.6 height', () => {
    const day = makeDay({ date: '2025-06-01', generatedKwh: 6, exportKwh: 0, consumedKwh: 10 });
    const result = normalizeSeries([day], 'solar_coverage', noSchedules);
    expect(result[0].normalizedHeight).toBeCloseTo(0.6, 3);
    expect(result[0].rawValue).toBeCloseTo(0.6, 3);
  });

  it('prorata_coverage caps normalizedHeight at 1 even when rawValue > 1', () => {
    const highSavingsDay = makeDay({
      date: '2025-06-01',
      billing: { ...makeDay().billing!, savings: 50 },
    });
    const result = normalizeSeries([highSavingsDay], 'prorata_coverage', [activeSchedule]);
    expect(result[0].normalizedHeight).toBe(1);
    expect(result[0].rawValue!).toBeGreaterThan(1);
  });

  it('preserves rawValue for tooltip use', () => {
    const day = makeDay({ date: '2025-06-15', generatedKwh: 7 });
    const result = normalizeSeries([day], 'generation_kwh', noSchedules);
    expect(result[0].rawValue).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// getDailyRepayment
// ---------------------------------------------------------------------------

describe('getDailyRepayment', () => {
  it('returns 0 when no schedules', () => {
    expect(getDailyRepayment([], '2025-06-15')).toBe(0);
  });

  it('returns daily pro-rata for an active schedule', () => {
    const expected = Math.round((100 * 12 / 365) * 100) / 100;
    expect(getDailyRepayment([activeSchedule], '2025-06-15')).toBeCloseTo(expected, 2);
  });

  it('returns 0 for a date outside the schedule duration', () => {
    const shortSchedule: RepaymentSchedule = {
      additionDate: '2020-01-01',
      monthlyRepayment: 100,
      repaymentDurationMonths: 12,
    };
    expect(getDailyRepayment([shortSchedule], '2025-06-15')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatDayValue
// ---------------------------------------------------------------------------

describe('formatDayValue', () => {
  it('formats kWh metrics with two decimals', () => {
    expect(formatDayValue(12.3, 'generation_kwh', 'EUR')).toBe('12.30 kWh');
  });

  it('formats currency metrics in EUR', () => {
    const result = formatDayValue(3.5, 'import_cost', 'EUR');
    expect(result).toContain('3.50');
    expect(result).toContain('€');
  });

  it('formats solar_coverage as percentage', () => {
    expect(formatDayValue(0.6, 'solar_coverage', 'EUR')).toBe('60%');
  });

  it('formats prorata_coverage as percentage', () => {
    expect(formatDayValue(0.75, 'prorata_coverage', 'EUR')).toBe('75%');
    expect(formatDayValue(1.2, 'prorata_coverage', 'EUR')).toBe('120%');
  });
});

// ---------------------------------------------------------------------------
// findBestDates
// ---------------------------------------------------------------------------

function makeNormalized(date: string, rawValue: number | null): NormalizedDay {
  return { date, normalizedHeight: rawValue !== null ? rawValue : null, rawValue };
}

describe('findBestDates', () => {
  it('returns the date with the highest value for higher-is-better metrics', () => {
    const days = [
      makeNormalized('2025-01-01', 10),
      makeNormalized('2025-01-02', 5),
      makeNormalized('2025-01-03', 8),
    ];
    expect(findBestDates(days, 'generation_kwh')).toEqual(new Set(['2025-01-01']));
  });

  it('returns all tied dates when multiple days share the peak', () => {
    const days = [
      makeNormalized('2025-01-01', 10),
      makeNormalized('2025-01-02', 10),
      makeNormalized('2025-01-03', 7),
    ];
    expect(findBestDates(days, 'generation_kwh')).toEqual(new Set(['2025-01-01', '2025-01-02']));
  });

  it('returns the date with the lowest value for lower-is-better metrics', () => {
    const days = [
      makeNormalized('2025-01-01', 10),
      makeNormalized('2025-01-02', 3),
      makeNormalized('2025-01-03', 7),
    ];
    expect(findBestDates(days, 'import_kwh')).toEqual(new Set(['2025-01-02']));
  });

  it('excludes days with null values', () => {
    const days = [
      makeNormalized('2025-01-01', null),
      makeNormalized('2025-01-02', 5),
    ];
    expect(findBestDates(days, 'generation_kwh')).toEqual(new Set(['2025-01-02']));
  });

  it('returns the date with the highest ratio for prorata_coverage', () => {
    const days = [
      makeNormalized('2025-01-01', 1.2),
      makeNormalized('2025-01-02', 2.28),
      makeNormalized('2025-01-03', 0.5),
    ];
    expect(findBestDates(days, 'prorata_coverage')).toEqual(new Set(['2025-01-02']));
  });

  it('returns empty set when all values are zero or negative for higher-is-better', () => {
    const days = [makeNormalized('2025-01-01', 0), makeNormalized('2025-01-02', 0)];
    expect(findBestDates(days, 'generation_kwh')).toEqual(new Set());
  });
});
