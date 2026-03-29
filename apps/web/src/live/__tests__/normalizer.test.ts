import { describe, it, expect } from 'vitest';
import {
  buildHalfHourData,
  buildHourData,
  buildSummary,
  buildHealth,
  buildDayDetail,
} from '../normalizer';
import type { MinuteReading } from '../types';

function makeMinute(hour: number, minute: number, overrides: Partial<MinuteReading> = {}): MinuteReading {
  return {
    hour,
    minute,
    importKwh: 0,
    exportKwh: 0,
    generatedKwh: 0,
    consumedKwh: 0,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    selfConsumptionRatio: 0,
    ...overrides,
  };
}

// Build a full 1440-minute day with all zeros
function makeFullDay(): MinuteReading[] {
  const minutes: MinuteReading[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      minutes.push(makeMinute(h, m));
    }
  }
  return minutes;
}

describe('buildHalfHourData', () => {
  it('groups minutes into correct half-hour buckets', () => {
    const minutes = [
      makeMinute(10, 0, { importKwh: 0.1 }),
      makeMinute(10, 15, { importKwh: 0.2 }),
      makeMinute(10, 30, { importKwh: 0.4 }),
      makeMinute(10, 45, { importKwh: 0.1 }),
    ];
    const result = buildHalfHourData(minutes);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ hour: 10, minute: 0, importKwh: 0.30000000000000004 });
    expect(result[1]).toMatchObject({ hour: 10, minute: 30, importKwh: 0.5 });
  });

  it('returns empty array for empty input', () => {
    expect(buildHalfHourData([])).toEqual([]);
  });

  it('returns sorted by time', () => {
    const minutes = [
      makeMinute(2, 0),
      makeMinute(1, 30),
      makeMinute(1, 0),
    ];
    const result = buildHalfHourData(minutes);
    expect(result.map(r => `${r.hour}:${r.minute}`)).toEqual(['1:0', '1:30', '2:0']);
  });
});

describe('buildHourData', () => {
  it('groups minutes into correct hour buckets', () => {
    const minutes = [
      makeMinute(5, 0, { generatedKwh: 0.1 }),
      makeMinute(5, 30, { generatedKwh: 0.2 }),
      makeMinute(6, 0, { generatedKwh: 0.5 }),
    ];
    const result = buildHourData(minutes);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ hour: 5, minute: 0, generatedKwh: 0.30000000000000004 });
    expect(result[1]).toMatchObject({ hour: 6, minute: 0, generatedKwh: 0.5 });
  });

  it('returns empty array for empty input', () => {
    expect(buildHourData([])).toEqual([]);
  });
});

describe('buildSummary', () => {
  it('returns all zeros for empty input', () => {
    const summary = buildSummary([]);
    expect(summary.totalImportKwh).toBe(0);
    expect(summary.totalGeneratedKwh).toBe(0);
    expect(summary.selfConsumptionRatio).toBe(0);
    expect(summary.gridDependenceRatio).toBe(0);
  });

  it('sums totals correctly', () => {
    const minutes = [
      makeMinute(10, 0, { importKwh: 1, generatedKwh: 2, exportKwh: 0.5, consumedKwh: 2.5 }),
      makeMinute(10, 1, { importKwh: 0.5, generatedKwh: 1, exportKwh: 0, consumedKwh: 1.5 }),
    ];
    const summary = buildSummary(minutes);
    expect(summary.totalImportKwh).toBeCloseTo(1.5);
    expect(summary.totalGeneratedKwh).toBeCloseTo(3);
    expect(summary.totalExportKwh).toBeCloseTo(0.5);
    expect(summary.totalConsumedKwh).toBeCloseTo(4);
  });

  it('calculates selfConsumptionRatio correctly', () => {
    // consumed=4, import=1 → solar=3, ratio=3/4=0.75
    const minutes = [makeMinute(10, 0, { importKwh: 1, consumedKwh: 4 })];
    const summary = buildSummary(minutes);
    expect(summary.selfConsumptionRatio).toBeCloseTo(0.75);
  });

  it('calculates gridDependenceRatio correctly', () => {
    // consumed=4, import=1 → ratio=0.25
    const minutes = [makeMinute(10, 0, { importKwh: 1, consumedKwh: 4 })];
    const summary = buildSummary(minutes);
    expect(summary.gridDependenceRatio).toBeCloseTo(0.25);
  });
});

describe('buildHealth', () => {
  const fetchedAt = '2026-03-29T10:00:00.000Z';

  it('marks full day correctly', () => {
    const health = buildHealth(makeFullDay(), fetchedAt);
    expect(health.recordCount).toBe(1440);
    expect(health.isPartialDay).toBe(false);
    expect(health.completenessRatio).toBe(1);
    expect(health.hasSuspiciousReadings).toBe(false);
  });

  it('marks partial day when fewer than 1440 records', () => {
    const health = buildHealth([makeMinute(0, 0)], fetchedAt);
    expect(health.isPartialDay).toBe(true);
    expect(health.completenessRatio).toBeCloseTo(1 / 1440);
  });

  it('returns zero counts for empty input', () => {
    const health = buildHealth([], fetchedAt);
    expect(health.recordCount).toBe(0);
    expect(health.isPartialDay).toBe(true);
    expect(health.hasSuspiciousReadings).toBe(false);
  });

  it('does not flag suspicious for a small gap within threshold', () => {
    // 5-minute gap is exactly at the threshold, not over it
    const minutes: MinuteReading[] = [];
    for (let m = 0; m < 60; m++) {
      if (m >= 10 && m <= 14) continue; // 5-minute gap at minutes 10-14
      minutes.push(makeMinute(0, m));
    }
    const health = buildHealth(minutes, fetchedAt);
    expect(health.hasSuspiciousReadings).toBe(false);
  });

  it('flags suspicious for a gap exceeding threshold', () => {
    const minutes: MinuteReading[] = [];
    for (let m = 0; m < 60; m++) {
      if (m >= 10 && m <= 16) continue; // 7-minute gap
      minutes.push(makeMinute(0, m));
    }
    const health = buildHealth(minutes, fetchedAt);
    expect(health.hasSuspiciousReadings).toBe(true);
  });
});

describe('buildDayDetail', () => {
  it('returns correct top-level shape', () => {
    const fetchedAt = '2026-03-29T10:00:00.000Z';
    const result = buildDayDetail('2026-03-29', [], fetchedAt);

    expect(result.meta.date).toBe('2026-03-29');
    expect(result.meta.timezone).toBe('Europe/Dublin');
    expect(result.meta.source).toBe('v1-bridge');
    expect(result.meta.fetchedAt).toBe(fetchedAt);
    expect(Array.isArray(result.minuteData)).toBe(true);
    expect(Array.isArray(result.halfHourData)).toBe(true);
    expect(Array.isArray(result.hourData)).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.health).toBeDefined();
  });
});
