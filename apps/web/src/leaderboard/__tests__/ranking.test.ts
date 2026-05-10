import { describe, it, expect } from 'vitest';
import type { RangeSeriesDay } from '../../range/types';
import type { RepaymentSchedule } from '../../range/recovery';
import { computeLeaderboard, formatLeaderboardDate } from '../ranking';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDay(
  date: string,
  overrides: Partial<RangeSeriesDay> = {},
): RangeSeriesDay {
  return {
    date,
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
const currency = 'EUR';

// ---------------------------------------------------------------------------
// formatLeaderboardDate
// ---------------------------------------------------------------------------

describe('formatLeaderboardDate', () => {
  it('formats a Monday date correctly', () => {
    // 2024-07-22 is a Monday
    const result = formatLeaderboardDate('2024-07-22');
    expect(result).toBe('Mon 22nd July 2024');
  });

  it('uses st suffix for 1st', () => {
    // 2024-07-01 is a Monday
    const result = formatLeaderboardDate('2024-07-01');
    expect(result).toContain('1st');
  });

  it('uses rd suffix for 3rd', () => {
    const result = formatLeaderboardDate('2024-07-03');
    expect(result).toContain('3rd');
  });

  it('uses th suffix for 11th (special case)', () => {
    const result = formatLeaderboardDate('2024-07-11');
    expect(result).toContain('11th');
  });

  it('uses th suffix for 12th (special case)', () => {
    const result = formatLeaderboardDate('2024-07-12');
    expect(result).toContain('12th');
  });

  it('uses th suffix for 13th (special case)', () => {
    const result = formatLeaderboardDate('2024-07-13');
    expect(result).toContain('13th');
  });
});

// ---------------------------------------------------------------------------
// computeLeaderboard — general
// ---------------------------------------------------------------------------

describe('computeLeaderboard', () => {
  it('returns one entry per CALENDAR_METRICS metric', () => {
    const series = [makeDay('2024-01-01')];
    const result = computeLeaderboard(series, noSchedules, currency);
    // 13 metrics in CALENDAR_METRICS
    expect(result).toHaveLength(13);
  });

  it('returns empty entries for a metric with no qualifying data', () => {
    const series = [makeDay('2024-01-01', { hasSummary: false })];
    const result = computeLeaderboard(series, noSchedules, currency);
    for (const lb of result) {
      expect(lb.entries).toHaveLength(0);
    }
  });

  it('ranks top 5 for a simple generation series', () => {
    const series = [
      makeDay('2024-01-01', { generatedKwh: 10 }),
      makeDay('2024-01-02', { generatedKwh: 20 }),
      makeDay('2024-01-03', { generatedKwh: 5 }),
      makeDay('2024-01-04', { generatedKwh: 15 }),
      makeDay('2024-01-05', { generatedKwh: 8 }),
      makeDay('2024-01-06', { generatedKwh: 25 }),
      makeDay('2024-01-07', { generatedKwh: 12 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    expect(gen.entries).toHaveLength(5);
    expect(gen.entries[0].date).toBe('2024-01-06'); // 25 kWh
    expect(gen.entries[0].rank).toBe(1);
    expect(gen.entries[1].date).toBe('2024-01-02'); // 20 kWh
    expect(gen.entries[1].rank).toBe(2);
    expect(gen.entries[4].rank).toBe(5);
  });

  it('caps at topN=5 by default', () => {
    const series = Array.from({ length: 10 }, (_, i) =>
      makeDay(`2024-01-${String(i + 1).padStart(2, '0')}`, { generatedKwh: (i + 1) * 2 }),
    );
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    expect(gen.entries).toHaveLength(5);
    expect(gen.totalDaysWithData).toBe(10);
  });

  it('respects a custom topN', () => {
    const series = Array.from({ length: 10 }, (_, i) =>
      makeDay(`2024-01-${String(i + 1).padStart(2, '0')}`, { generatedKwh: (i + 1) * 2 }),
    );
    const result = computeLeaderboard(series, noSchedules, currency, 3);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    expect(gen.entries).toHaveLength(3);
  });

  it('handles fewer than 5 qualifying days', () => {
    const series = [
      makeDay('2024-01-01', { generatedKwh: 10 }),
      makeDay('2024-01-02', { generatedKwh: 20 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    expect(gen.entries).toHaveLength(2);
    expect(gen.totalDaysWithData).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Lower-better metrics
// ---------------------------------------------------------------------------

describe('computeLeaderboard — lower-better metrics', () => {
  it('ranks import_kwh ascending (lowest import = rank 1)', () => {
    const series = [
      makeDay('2024-01-01', { importKwh: 10 }),
      makeDay('2024-01-02', { importKwh: 2 }),
      makeDay('2024-01-03', { importKwh: 7 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const imp = result.find((r) => r.metric.id === 'import_kwh')!;
    expect(imp.entries[0].date).toBe('2024-01-02'); // lowest import
    expect(imp.entries[0].rank).toBe(1);
  });

  it('ranks import_cost ascending', () => {
    const series = [
      makeDay('2024-01-01', { billing: { actualNetCost: 5, savings: 1, exportCredit: 0.5, importCost: 5, fixedCharges: 0.5, selfConsumedSolarValue: 1, freeImportKwh: 0 } }),
      makeDay('2024-01-02', { billing: { actualNetCost: 1, savings: 2, exportCredit: 0.5, importCost: 1, fixedCharges: 0.5, selfConsumedSolarValue: 1, freeImportKwh: 0 } }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const cost = result.find((r) => r.metric.id === 'import_cost')!;
    expect(cost.entries[0].rawValue).toBe(1);
    expect(cost.entries[0].rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tie handling
// ---------------------------------------------------------------------------

describe('computeLeaderboard — ties', () => {
  it('assigns the same rank to tied values', () => {
    const series = [
      makeDay('2024-01-01', { generatedKwh: 20 }),
      makeDay('2024-01-02', { generatedKwh: 20 }),
      makeDay('2024-01-03', { generatedKwh: 15 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    const rank1Entries = gen.entries.filter((e) => e.rank === 1);
    expect(rank1Entries).toHaveLength(2);
    const rank2Entries = gen.entries.filter((e) => e.rank === 2);
    expect(rank2Entries).toHaveLength(1);
  });

  it('includes all tied entries even when it exceeds topN', () => {
    // 5 days at rank 1 and a 6th at rank 2 — all 5 ties should appear
    const series = [
      makeDay('2024-01-01', { generatedKwh: 20 }),
      makeDay('2024-01-02', { generatedKwh: 20 }),
      makeDay('2024-01-03', { generatedKwh: 20 }),
      makeDay('2024-01-04', { generatedKwh: 20 }),
      makeDay('2024-01-05', { generatedKwh: 20 }),
      makeDay('2024-01-06', { generatedKwh: 10 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    // topN=5 rank positions, but rank 1 has 5 entries — rank 2 not reached
    expect(gen.entries).toHaveLength(5);
    expect(gen.entries.every((e) => e.rank === 1)).toBe(true);
  });

  it('does not include rank 2 once topN rank slots are exhausted by ties', () => {
    // 3 ties at rank 1, 2 ties at rank 2 — topN=5 but rank 3 not shown
    const series = [
      makeDay('2024-01-01', { generatedKwh: 20 }),
      makeDay('2024-01-02', { generatedKwh: 20 }),
      makeDay('2024-01-03', { generatedKwh: 20 }),
      makeDay('2024-01-04', { generatedKwh: 15 }),
      makeDay('2024-01-05', { generatedKwh: 15 }),
      makeDay('2024-01-06', { generatedKwh: 10 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency, 5);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    // Ranks 1 (3 entries) + 2 (2 entries) = 5 entries; rank 3 not reached
    expect(gen.entries).toHaveLength(5);
    expect(gen.entries.filter((e) => e.rank === 1)).toHaveLength(3);
    expect(gen.entries.filter((e) => e.rank === 2)).toHaveLength(2);
    expect(gen.entries.some((e) => e.rank === 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Zero / non-positive exclusion for higher-is-better
// ---------------------------------------------------------------------------

describe('computeLeaderboard — zero exclusion', () => {
  it('excludes zero-generation days from generation_kwh ranking', () => {
    const series = [
      makeDay('2024-01-01', { generatedKwh: 0 }),
      makeDay('2024-01-02', { generatedKwh: 10 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const gen = result.find((r) => r.metric.id === 'generation_kwh')!;
    expect(gen.entries).toHaveLength(1);
    expect(gen.totalDaysWithData).toBe(1);
  });

  it('includes zero import for import_kwh (lower-better, zero is great)', () => {
    const series = [
      makeDay('2024-01-01', { importKwh: 0 }),
      makeDay('2024-01-02', { importKwh: 5 }),
    ];
    const result = computeLeaderboard(series, noSchedules, currency);
    const imp = result.find((r) => r.metric.id === 'import_kwh')!;
    expect(imp.entries).toHaveLength(2);
    expect(imp.entries[0].rawValue).toBe(0);
    expect(imp.entries[0].rank).toBe(1);
  });
});
