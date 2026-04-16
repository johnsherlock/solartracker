import { describe, it, expect } from 'vitest';
import type { MinuteReading } from '../../live/types';
import {
  getLocalDate,
  getPreviousLocalDate,
  isAfterMidnightBuffer,
  expectedMinutesForDay,
  deriveDailySummaryFields,
  deriveBandBreakdown,
  deriveDailySummaryFieldsScheduled,
  type TariffWindows,
} from '../derive-summary';
import type { TariffPricePeriod, WeeklySchedule } from '../../domain/billing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReading(overrides: Partial<MinuteReading> = {}): MinuteReading {
  return {
    hour: 0,
    minute: 0,
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

function makeReadings(count: number, perMinute: Partial<MinuteReading> = {}): MinuteReading[] {
  return Array.from({ length: count }, (_, i) =>
    makeReading({ hour: Math.floor(i / 60), minute: i % 60, ...perMinute }),
  );
}

// ---------------------------------------------------------------------------
// getLocalDate
// ---------------------------------------------------------------------------

describe('getLocalDate', () => {
  it('returns YYYY-MM-DD for Europe/Dublin in winter (UTC = local)', () => {
    // 2024-01-15T10:30:00Z — winter, UTC = local
    const date = getLocalDate('Europe/Dublin', new Date('2024-01-15T10:30:00Z'));
    expect(date).toBe('2024-01-15');
  });

  it('returns local date (UTC+1) for Europe/Dublin in summer', () => {
    // 2024-07-01T23:30:00Z = 2024-07-02T00:30:00 BST
    const date = getLocalDate('Europe/Dublin', new Date('2024-07-01T23:30:00Z'));
    expect(date).toBe('2024-07-02');
  });

  it('returns UTC date for Europe/Dublin at UTC midnight in summer', () => {
    // 2024-07-02T00:00:00Z = 2024-07-02T01:00:00 BST — already the next local day
    const date = getLocalDate('Europe/Dublin', new Date('2024-07-02T00:00:00Z'));
    expect(date).toBe('2024-07-02');
  });
});

// ---------------------------------------------------------------------------
// getPreviousLocalDate
// ---------------------------------------------------------------------------

describe('getPreviousLocalDate', () => {
  it('returns yesterday in a normal winter case', () => {
    // 2024-01-15T10:00:00Z — local today is 2024-01-15, so yesterday is 2024-01-14
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-01-15T10:00:00Z'));
    expect(prev).toBe('2024-01-14');
  });

  it('returns correct previous day in summer (UTC offset)', () => {
    // 2024-07-02T00:30:00Z = 2024-07-02T01:30:00 BST — local today is 2024-07-02
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-07-02T00:30:00Z'));
    expect(prev).toBe('2024-07-01');
  });

  it('handles DST spring-forward: 2024-03-31 (clocks go forward at 01:00 UTC)', () => {
    // After spring-forward (e.g. 02:00 local on 2024-03-31), local today is 2024-03-31
    // Previous day should be 2024-03-30.
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-03-31T10:00:00Z'));
    expect(prev).toBe('2024-03-30');
  });

  it('handles DST fall-back: 2024-10-27 (clocks go back at 01:00 UTC)', () => {
    // After fall-back on 2024-10-27, local today is 2024-10-27
    // Previous day should be 2024-10-26.
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-10-27T10:00:00Z'));
    expect(prev).toBe('2024-10-26');
  });

  it('crosses a month boundary correctly', () => {
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-03-01T12:00:00Z'));
    expect(prev).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('crosses a year boundary correctly', () => {
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-01-01T12:00:00Z'));
    expect(prev).toBe('2023-12-31');
  });
});

// ---------------------------------------------------------------------------
// isAfterMidnightBuffer
// ---------------------------------------------------------------------------

describe('isAfterMidnightBuffer', () => {
  it('returns false at 00:00 local (exactly midnight)', () => {
    // 2024-01-15T00:00:00Z = midnight local in winter
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-01-15T00:00:00Z'))).toBe(false);
  });

  it('returns false at 00:14 local (within buffer)', () => {
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-01-15T00:14:00Z'))).toBe(false);
  });

  it('returns true at 00:15 local (at the buffer boundary)', () => {
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-01-15T00:15:00Z'))).toBe(true);
  });

  it('returns true well past midnight', () => {
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-01-15T10:00:00Z'))).toBe(true);
  });

  it('handles summer time (UTC+1): 00:15 UTC = 01:15 local — returns true', () => {
    // In BST, UTC 00:15 = local 01:15, well past midnight buffer
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-07-15T00:15:00Z'))).toBe(true);
  });

  it('handles summer time: 23:00 UTC = 00:00 local BST — at local midnight, before buffer', () => {
    // 2024-07-15T23:00:00Z = 2024-07-16T00:00:00 BST
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-07-15T23:00:00Z'))).toBe(false);
  });

  it('respects a custom buffer value', () => {
    // 00:30 UTC in winter = 00:30 local
    expect(isAfterMidnightBuffer('Europe/Dublin', 60, new Date('2024-01-15T00:30:00Z'))).toBe(false);
    expect(isAfterMidnightBuffer('Europe/Dublin', 60, new Date('2024-01-15T01:00:00Z'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// expectedMinutesForDay
// ---------------------------------------------------------------------------

describe('expectedMinutesForDay', () => {
  it('returns 1440 for a normal day', () => {
    expect(expectedMinutesForDay('2024-01-15', 'Europe/Dublin')).toBe(1440);
  });

  it('returns 1380 for the spring-forward day (2024-03-31, 23-hour day)', () => {
    expect(expectedMinutesForDay('2024-03-31', 'Europe/Dublin')).toBe(1380);
  });

  it('returns 1500 for the fall-back day (2024-10-27, 25-hour day)', () => {
    expect(expectedMinutesForDay('2024-10-27', 'Europe/Dublin')).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// deriveDailySummaryFields
// ---------------------------------------------------------------------------

describe('deriveDailySummaryFields', () => {
  it('sums all energy fields across all minute readings', () => {
    const readings = makeReadings(3, {
      importKwh: 0.01,
      exportKwh: 0.005,
      generatedKwh: 0.02,
      consumedKwh: 0.015,
      immersionDivertedKwh: 0.002,
      immersionBoostedKwh: 0.001,
    });

    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.importKwh).toBeCloseTo(0.03, 6);
    expect(result.exportKwh).toBeCloseTo(0.015, 6);
    expect(result.generatedKwh).toBeCloseTo(0.06, 6);
    expect(result.consumedKwh).toBeCloseTo(0.045, 6);
    expect(result.immersionDivertedKwh).toBeCloseTo(0.006, 6);
    expect(result.immersionBoostedKwh).toBeCloseTo(0.003, 6);
  });

  it('marks isPartial false when readings count meets expected', () => {
    const readings = makeReadings(1440);
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.isPartial).toBe(false);
  });

  it('marks isPartial true when readings count is below expected', () => {
    const readings = makeReadings(720);
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.isPartial).toBe(true);
  });

  it('marks isPartial false for a spring-forward day with 1380 readings', () => {
    const readings = makeReadings(1380);
    const result = deriveDailySummaryFields(readings, 1380);
    expect(result.isPartial).toBe(false);
  });

  it('marks isPartial false for a fall-back day with 1500 readings', () => {
    const readings = makeReadings(1500);
    const result = deriveDailySummaryFields(readings, 1500);
    expect(result.isPartial).toBe(false);
  });

  it('computes selfConsumptionRatio correctly', () => {
    // consumed=1.0, import=0.4 => solarConsumed=0.6 => ratio=0.6
    const readings = [makeReading({ consumedKwh: 1.0, importKwh: 0.4 })];
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.selfConsumptionRatio).toBeCloseTo(0.6, 6);
  });

  it('computes gridDependenceRatio correctly', () => {
    // consumed=1.0, import=0.4 => ratio=0.4
    const readings = [makeReading({ consumedKwh: 1.0, importKwh: 0.4 })];
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.gridDependenceRatio).toBeCloseTo(0.4, 6);
  });

  it('returns null ratios when consumed is zero', () => {
    const readings = [makeReading({ consumedKwh: 0 })];
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.selfConsumptionRatio).toBeNull();
    expect(result.gridDependenceRatio).toBeNull();
  });

  it('clamps selfConsumptionRatio to 0 when import exceeds consumed', () => {
    // import > consumed (should not happen physically but clamp is defensive)
    const readings = [makeReading({ consumedKwh: 0.5, importKwh: 1.0 })];
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.selfConsumptionRatio).toBe(0);
    expect(result.gridDependenceRatio).toBeCloseTo(2.0, 6);
  });

  it('handles empty readings (no data day)', () => {
    const result = deriveDailySummaryFields([], 1440);
    expect(result.importKwh).toBe(0);
    expect(result.exportKwh).toBe(0);
    expect(result.generatedKwh).toBe(0);
    expect(result.consumedKwh).toBe(0);
    expect(result.selfConsumptionRatio).toBeNull();
    expect(result.gridDependenceRatio).toBeNull();
    expect(result.isPartial).toBe(true);
  });

  it('returns null band fields when no tariff windows are supplied', () => {
    const readings = [makeReading({ hour: 2, minute: 0, importKwh: 0.1 })];
    const result = deriveDailySummaryFields(readings, 1440);
    expect(result.dayImportKwh).toBeNull();
    expect(result.nightImportKwh).toBeNull();
    expect(result.peakImportKwh).toBeNull();
    expect(result.freeImportKwh).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveDailySummaryFields — band classification
// ---------------------------------------------------------------------------

describe('deriveDailySummaryFields — band classification', () => {
  const windows: TariffWindows = {
    nightStartLocalTime: '23:00',
    nightEndLocalTime: '08:00',
    peakStartLocalTime: '17:00',
    peakEndLocalTime: '19:00',
  };

  it('classifies a mid-day reading as day import', () => {
    const readings = [makeReading({ hour: 12, minute: 0, importKwh: 1.0 })];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    expect(result.dayImportKwh).toBeCloseTo(1.0, 6);
    expect(result.nightImportKwh).toBeCloseTo(0, 6);
    expect(result.peakImportKwh).toBeCloseTo(0, 6);
  });

  it('classifies a peak reading as peak import', () => {
    const readings = [makeReading({ hour: 17, minute: 30, importKwh: 0.5 })];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    expect(result.peakImportKwh).toBeCloseTo(0.5, 6);
    expect(result.dayImportKwh).toBeCloseTo(0, 6);
    expect(result.nightImportKwh).toBeCloseTo(0, 6);
  });

  it('classifies an early-morning reading in the midnight-crossing night window', () => {
    // 02:00 is inside 23:00–08:00 (midnight-crossing)
    const readings = [makeReading({ hour: 2, minute: 0, importKwh: 0.8 })];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    expect(result.nightImportKwh).toBeCloseTo(0.8, 6);
    expect(result.dayImportKwh).toBeCloseTo(0, 6);
    expect(result.peakImportKwh).toBeCloseTo(0, 6);
  });

  it('classifies a late-night reading (23:30) in the midnight-crossing night window', () => {
    const readings = [makeReading({ hour: 23, minute: 30, importKwh: 0.6 })];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    expect(result.nightImportKwh).toBeCloseTo(0.6, 6);
    expect(result.dayImportKwh).toBeCloseTo(0, 6);
  });

  it('band totals sum to total importKwh across a mixed day', () => {
    // 6 readings spread across different bands
    const readings = [
      makeReading({ hour: 2, minute: 0, importKwh: 0.3 }),   // night
      makeReading({ hour: 8, minute: 0, importKwh: 0.5 }),   // day (08:00 is end of night, exclusive)
      makeReading({ hour: 12, minute: 0, importKwh: 0.7 }),  // day
      makeReading({ hour: 17, minute: 0, importKwh: 0.4 }),  // peak
      makeReading({ hour: 18, minute: 0, importKwh: 0.2 }),  // peak
      makeReading({ hour: 23, minute: 0, importKwh: 0.1 }),  // night
    ];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    const bandTotal = (result.dayImportKwh ?? 0) + (result.nightImportKwh ?? 0) + (result.peakImportKwh ?? 0);
    expect(bandTotal).toBeCloseTo(result.importKwh, 5);
  });

  it('peak takes priority over night when windows would overlap', () => {
    // Peak is checked first in the classification logic
    const overlappingWindows: TariffWindows = {
      nightStartLocalTime: '16:00',
      nightEndLocalTime: '20:00',
      peakStartLocalTime: '17:00',
      peakEndLocalTime: '19:00',
    };
    const readings = [makeReading({ hour: 17, minute: 30, importKwh: 1.0 })];
    const result = deriveDailySummaryFields(readings, 1440, overlappingWindows);
    expect(result.peakImportKwh).toBeCloseTo(1.0, 6);
    expect(result.nightImportKwh).toBeCloseTo(0, 6);
  });

  it('freeImportKwh is always null (deferred)', () => {
    const readings = [makeReading({ hour: 12, minute: 0, importKwh: 1.0 })];
    const result = deriveDailySummaryFields(readings, 1440, windows);
    expect(result.freeImportKwh).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Schedule-based derivation
// ---------------------------------------------------------------------------

// Fixtures: 3-period schedule for a simple day/night/free tariff.
// 2025-05-05 is a Monday (dayIndex 0).
// Night: slots 0–15 (00:00–07:30) and 46–47 (23:00–23:30)
// Free: slot 24 (12:00–12:29)
// Day: everything else

const pDay: TariffPricePeriod = {
  id: 'pd', tariffPlanVersionId: 'v1', periodLabel: 'Day',
  ratePerKwh: 0.30, isFreeImport: false, sortOrder: 0,
};
const pNight: TariffPricePeriod = {
  id: 'pn', tariffPlanVersionId: 'v1', periodLabel: 'Night',
  ratePerKwh: 0.15, isFreeImport: false, sortOrder: 1,
};
const pFree: TariffPricePeriod = {
  id: 'pf', tariffPlanVersionId: 'v1', periodLabel: 'Free',
  ratePerKwh: 0, isFreeImport: true, sortOrder: 2,
};

// Build a schedule for Monday (dayIndex 0) with night / free slots
function buildTestSchedule(): WeeklySchedule {
  const schedule: WeeklySchedule = Array(336).fill('pd');
  // Night: slots 0–15 and 46–47 for all days
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot <= 15; slot++) schedule[day * 48 + slot] = 'pn';
    schedule[day * 48 + 46] = 'pn';
    schedule[day * 48 + 47] = 'pn';
    // Free: slot 24 (12:00)
    schedule[day * 48 + 24] = 'pf';
  }
  return schedule;
}

const testSchedule = buildTestSchedule();
const testPeriods = [pDay, pNight, pFree];
const monday = '2025-05-05';

describe('deriveBandBreakdown', () => {
  it('accumulates import kWh into the correct period bucket', () => {
    const readings = [
      makeReading({ hour: 12, minute: 0, importKwh: 1.0 }), // free slot (12:00)
      makeReading({ hour: 14, minute: 0, importKwh: 2.0 }), // day slot
      makeReading({ hour: 23, minute: 0, importKwh: 0.5 }), // night slot (23:00 = slot 46)
    ];

    const { breakdown, freeImportKwh } = deriveBandBreakdown(readings, monday, testSchedule, testPeriods);

    expect(breakdown['pd']).toBeCloseTo(2.0, 6);
    expect(breakdown['pn']).toBeCloseTo(0.5, 6);
    expect(breakdown['pf']).toBeCloseTo(1.0, 6);
    expect(freeImportKwh).toBeCloseTo(1.0, 6);
  });

  it('returns empty breakdown and zero freeImportKwh for empty readings', () => {
    const { breakdown, freeImportKwh } = deriveBandBreakdown([], monday, testSchedule, testPeriods);
    expect(Object.keys(breakdown)).toHaveLength(0);
    expect(freeImportKwh).toBe(0);
  });

  it('accumulates multiple readings into the same period', () => {
    const readings = [
      makeReading({ hour: 10, minute: 0, importKwh: 0.5 }),
      makeReading({ hour: 10, minute: 30, importKwh: 0.5 }),
      makeReading({ hour: 11, minute: 0, importKwh: 0.5 }),
    ];
    const { breakdown } = deriveBandBreakdown(readings, monday, testSchedule, testPeriods);
    expect(breakdown['pd']).toBeCloseTo(1.5, 6);
  });
});

describe('deriveDailySummaryFieldsScheduled', () => {
  it('populates bandBreakdownJson and leaves fixed band fields null', () => {
    const readings = [
      makeReading({ hour: 14, minute: 0, importKwh: 1.0 }), // day
      makeReading({ hour: 0, minute: 0, importKwh: 0.5 }),   // night
    ];

    const result = deriveDailySummaryFieldsScheduled(readings, 1440, monday, testSchedule, testPeriods);

    expect(result.dayImportKwh).toBeNull();
    expect(result.nightImportKwh).toBeNull();
    expect(result.peakImportKwh).toBeNull();
    expect(result.bandBreakdownJson).not.toBeNull();
    expect(result.bandBreakdownJson?.['pd']).toBeCloseTo(1.0, 6);
    expect(result.bandBreakdownJson?.['pn']).toBeCloseTo(0.5, 6);
  });

  it('sets freeImportKwh when free-period readings exist', () => {
    const readings = [
      makeReading({ hour: 12, minute: 0, importKwh: 2.0 }), // free slot
    ];
    const result = deriveDailySummaryFieldsScheduled(readings, 1440, monday, testSchedule, testPeriods);
    expect(result.freeImportKwh).toBeCloseTo(2.0, 6);
  });

  it('sets freeImportKwh to null when no free-period readings exist', () => {
    const readings = [makeReading({ hour: 14, minute: 0, importKwh: 1.0 })];
    const result = deriveDailySummaryFieldsScheduled(readings, 1440, monday, testSchedule, testPeriods);
    expect(result.freeImportKwh).toBeNull();
  });

  it('marks the summary as partial when readings are fewer than expected', () => {
    const readings = [makeReading({ hour: 14, minute: 0, importKwh: 1.0 })];
    const result = deriveDailySummaryFieldsScheduled(readings, 1440, monday, testSchedule, testPeriods);
    expect(result.isPartial).toBe(true);
  });

  it('produces the same energy totals as deriveDailySummaryFields', () => {
    const readings = makeReadings(1440, { importKwh: 0.001, exportKwh: 0.0005, generatedKwh: 0.002, consumedKwh: 0.0015 });
    const scheduled = deriveDailySummaryFieldsScheduled(readings, 1440, monday, testSchedule, testPeriods);
    const simple = deriveDailySummaryFields(readings, 1440);

    expect(scheduled.importKwh).toBeCloseTo(simple.importKwh, 4);
    expect(scheduled.exportKwh).toBeCloseTo(simple.exportKwh, 4);
    expect(scheduled.generatedKwh).toBeCloseTo(simple.generatedKwh, 4);
    expect(scheduled.consumedKwh).toBeCloseTo(simple.consumedKwh, 4);
  });
});
