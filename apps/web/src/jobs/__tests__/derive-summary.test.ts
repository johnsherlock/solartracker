import { describe, it, expect } from 'vitest';
import type { MinuteReading } from '../../live/types';
import {
  getLocalDate,
  getPreviousLocalDate,
  isAfterMidnightBuffer,
  expectedMinutesForDay,
  utcStartOfLocalDate,
  aggregateToIntervalReadings,
} from '../derive-summary';

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
    const date = getLocalDate('Europe/Dublin', new Date('2024-01-15T10:30:00Z'));
    expect(date).toBe('2024-01-15');
  });

  it('returns local date (UTC+1) for Europe/Dublin in summer', () => {
    // 2024-07-01T23:30:00Z = 2024-07-02T00:30:00 BST
    const date = getLocalDate('Europe/Dublin', new Date('2024-07-01T23:30:00Z'));
    expect(date).toBe('2024-07-02');
  });

  it('returns UTC date for Europe/Dublin at UTC midnight in summer', () => {
    const date = getLocalDate('Europe/Dublin', new Date('2024-07-02T00:00:00Z'));
    expect(date).toBe('2024-07-02');
  });
});

// ---------------------------------------------------------------------------
// getPreviousLocalDate
// ---------------------------------------------------------------------------

describe('getPreviousLocalDate', () => {
  it('returns yesterday in a normal winter case', () => {
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-01-15T10:00:00Z'));
    expect(prev).toBe('2024-01-14');
  });

  it('returns correct previous day in summer (UTC offset)', () => {
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-07-02T00:30:00Z'));
    expect(prev).toBe('2024-07-01');
  });

  it('handles DST spring-forward: 2024-03-31', () => {
    const prev = getPreviousLocalDate('Europe/Dublin', new Date('2024-03-31T10:00:00Z'));
    expect(prev).toBe('2024-03-30');
  });

  it('handles DST fall-back: 2024-10-27', () => {
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
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-07-15T00:15:00Z'))).toBe(true);
  });

  it('handles summer time: 23:00 UTC = 00:00 local BST — at local midnight, before buffer', () => {
    expect(isAfterMidnightBuffer('Europe/Dublin', 15, new Date('2024-07-15T23:00:00Z'))).toBe(false);
  });

  it('respects a custom buffer value', () => {
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
// utcStartOfLocalDate
// ---------------------------------------------------------------------------

describe('utcStartOfLocalDate', () => {
  it('returns UTC midnight for a winter day (UTC+0)', () => {
    // 2024-01-15 in Dublin is UTC+0, so local midnight = UTC midnight
    const ms = utcStartOfLocalDate('2024-01-15', 'Europe/Dublin');
    expect(new Date(ms).toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns UTC 23:00 the previous day for a BST day (UTC+1)', () => {
    // 2024-07-15 in Dublin is BST (UTC+1), so local midnight = UTC 23:00 prev day
    const ms = utcStartOfLocalDate('2024-07-15', 'Europe/Dublin');
    expect(new Date(ms).toISOString()).toBe('2024-07-14T23:00:00.000Z');
  });

  it('returns the correct UTC start for the spring-forward day', () => {
    // 2024-03-31: clocks go forward from 01:00 to 02:00 (UTC 01:00)
    // Local midnight is UTC midnight (both UTC+0 at that point)
    const ms = utcStartOfLocalDate('2024-03-31', 'Europe/Dublin');
    expect(new Date(ms).toISOString()).toBe('2024-03-31T00:00:00.000Z');
  });

  it('returns the correct UTC start for the fall-back day', () => {
    // 2024-10-27: clocks go back from 02:00 BST to 01:00 GMT (UTC 01:00)
    // Local midnight on Oct 27 is at UTC 23:00 on Oct 26 (still BST)
    const ms = utcStartOfLocalDate('2024-10-27', 'Europe/Dublin');
    expect(new Date(ms).toISOString()).toBe('2024-10-26T23:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// aggregateToIntervalReadings
// ---------------------------------------------------------------------------

describe('aggregateToIntervalReadings', () => {
  const TZ = 'Europe/Dublin';
  const WINTER_DATE = '2024-01-15'; // UTC+0
  const SUMMER_DATE = '2024-07-15'; // UTC+1 (BST)

  it('returns empty array for empty readings', () => {
    const slots = aggregateToIntervalReadings([], WINTER_DATE, TZ);
    expect(slots).toHaveLength(0);
  });

  it('produces 48 slots for a full normal winter day', () => {
    const readings = makeReadings(1440);
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    expect(slots).toHaveLength(48);
  });

  it('produces 46 slots for a spring-forward day (23-hour day)', () => {
    const readings = makeReadings(1380);
    const slots = aggregateToIntervalReadings(readings, '2024-03-31', TZ);
    expect(slots).toHaveLength(46);
  });

  it('produces 50 slots for a fall-back day (25-hour day)', () => {
    const readings = makeReadings(1500);
    const slots = aggregateToIntervalReadings(readings, '2024-10-27', TZ);
    expect(slots).toHaveLength(50);
  });

  it('slot interval_start timestamps advance by exactly 30 minutes', () => {
    const readings = makeReadings(1440);
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    for (let i = 1; i < slots.length; i++) {
      const diff = slots[i].intervalStart.getTime() - slots[i - 1].intervalStart.getTime();
      expect(diff).toBe(30 * 60 * 1000);
    }
  });

  it('first slot start is UTC midnight for a winter day', () => {
    const readings = makeReadings(1440);
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    expect(slots[0].intervalStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('first slot start is UTC 23:00 prev day for a summer BST day', () => {
    const readings = makeReadings(1440);
    const slots = aggregateToIntervalReadings(readings, SUMMER_DATE, TZ);
    expect(slots[0].intervalStart.toISOString()).toBe('2024-07-14T23:00:00.000Z');
  });

  it('sums all energy fields within each 30-minute slot', () => {
    // 60 readings, each with importKwh=0.01 → 2 slots, each with importKwh=0.30
    const readings = makeReadings(60, { importKwh: 0.01 });
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    expect(slots).toHaveLength(48);
    expect(slots[0].importKwh).toBeCloseTo(0.30, 6);
    expect(slots[1].importKwh).toBeCloseTo(0.30, 6);
    // Later slots have no readings and are zeros
    expect(slots[2].importKwh).toBe(0);
  });

  it('readingCount matches number of readings in each slot', () => {
    const readings = makeReadings(1440);
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    for (const slot of slots) {
      expect(slot.readingCount).toBe(30);
    }
  });

  it('readingCount is less than 30 for a partial slot (partial day)', () => {
    const readings = makeReadings(45); // 1.5 slots worth
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    expect(slots[0].readingCount).toBe(30);
    expect(slots[1].readingCount).toBe(15);
    // Rest are 0
    expect(slots[2].readingCount).toBe(0);
  });

  it('sums all energy metric fields correctly', () => {
    const readings = makeReadings(30, {
      importKwh: 0.01,
      generatedKwh: 0.02,
      exportKwh: 0.005,
      consumedKwh: 0.015,
      immersionDivertedKwh: 0.002,
      immersionBoostedKwh: 0.001,
    });
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    const slot = slots[0];
    expect(slot.importKwh).toBeCloseTo(0.3, 6);
    expect(slot.generationKwh).toBeCloseTo(0.6, 6);
    expect(slot.exportKwh).toBeCloseTo(0.15, 6);
    expect(slot.consumedKwh).toBeCloseTo(0.45, 6);
    expect(slot.immersionDivertedKwh).toBeCloseTo(0.06, 6);
    expect(slot.immersionBoostedKwh).toBeCloseTo(0.03, 6);
  });

  it('total energy across all slots equals the daily total', () => {
    const readings = makeReadings(1440, { importKwh: 0.005, generatedKwh: 0.003 });
    const slots = aggregateToIntervalReadings(readings, WINTER_DATE, TZ);
    const totalImport = slots.reduce((s, sl) => s + sl.importKwh, 0);
    const totalGen = slots.reduce((s, sl) => s + sl.generationKwh, 0);
    expect(totalImport).toBeCloseTo(1440 * 0.005, 4);
    expect(totalGen).toBeCloseTo(1440 * 0.003, 4);
  });

  it('places gap-adjacent readings in their correct local-time slots, leaving gap slots empty', () => {
    // hour 0 (slots 0–1) and hour 2 (slots 4–5) with a gap at hour 1 (slots 2–3)
    const hour0 = Array.from({ length: 60 }, (_, i) =>
      makeReading({ hour: 0, minute: i, importKwh: 0.01 }),
    );
    const hour2 = Array.from({ length: 60 }, (_, i) =>
      makeReading({ hour: 2, minute: i, importKwh: 0.02 }),
    );
    const slots = aggregateToIntervalReadings([...hour0, ...hour2], WINTER_DATE, TZ);
    // slot 0 = 00:00–00:29 (30 readings × 0.01)
    expect(slots[0].importKwh).toBeCloseTo(0.30, 6);
    // slot 1 = 00:30–00:59 (30 readings × 0.01)
    expect(slots[1].importKwh).toBeCloseTo(0.30, 6);
    // slots 2–3 = 01:00–01:59 — gap, no readings
    expect(slots[2].importKwh).toBe(0);
    expect(slots[3].importKwh).toBe(0);
    // slot 4 = 02:00–02:29 (30 readings × 0.02)
    expect(slots[4].importKwh).toBeCloseTo(0.60, 6);
    // slot 5 = 02:30–02:59 (30 readings × 0.02)
    expect(slots[5].importKwh).toBeCloseTo(0.60, 6);
  });
});
