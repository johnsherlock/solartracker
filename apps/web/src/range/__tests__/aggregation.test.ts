import { describe, expect, it } from 'vitest';
import {
  aggregateRangeSeries,
  getAvailableRangeGroupings,
  getDefaultRangeGrouping,
} from '../aggregation';
import type { RangeSeriesDay } from '../types';

function makeDay(
  date: string,
  overrides: Partial<RangeSeriesDay> = {},
): RangeSeriesDay {
  return {
    date,
    hasSummary: true,
    generatedKwh: 10,
    importKwh: 5,
    exportKwh: 2,
    consumedKwh: 11,
    immersionDivertedKwh: 1,
    isPartial: false,
    billing: {
      actualNetCost: 3,
      savings: 2,
      exportCredit: 1,
      importCost: 4,
      fixedCharges: 0.5,
      selfConsumedSolarValue: 1,
      freeImportKwh: 0.25,
    },
    tariffVersionId: 'tariff-1',
    dayImportKwh: 2,
    nightImportKwh: 2,
    peakImportKwh: 1,
    ...overrides,
  };
}

describe('range aggregation helpers', () => {
  it('chooses sensible default groupings for wider windows', () => {
    expect(getDefaultRangeGrouping(20)).toBe('day');
    expect(getDefaultRangeGrouping(90)).toBe('week');
    expect(getDefaultRangeGrouping(300)).toBe('month');
  });

  it('offers week and month grouping only when the range is long enough', () => {
    expect(getAvailableRangeGroupings(20)).toEqual(['day']);
    expect(getAvailableRangeGroupings(90)).toEqual(['day', 'week']);
    expect(getAvailableRangeGroupings(300)).toEqual(['day', 'week', 'month']);
  });

  it('aggregates daily rows into ISO week buckets', () => {
    const result = aggregateRangeSeries(
      [
        makeDay('2026-05-11'),
        makeDay('2026-05-12'),
        makeDay('2026-05-18', { tariffVersionId: 'tariff-2' }),
      ],
      'week',
    );

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-05-11');
    expect(result[0].generatedKwh).toBe(20);
    expect(result[0].billing?.actualNetCost).toBe(6);
    expect(result[1].date).toBe('2026-05-18');
  });

  it('marks grouped rows partial when any day is missing or partial', () => {
    const result = aggregateRangeSeries(
      [
        makeDay('2026-05-01'),
        makeDay('2026-05-02', { hasSummary: false }),
        makeDay('2026-05-03', { isPartial: true }),
      ],
      'month',
    );

    expect(result).toHaveLength(1);
    expect(result[0].isPartial).toBe(true);
  });
});
