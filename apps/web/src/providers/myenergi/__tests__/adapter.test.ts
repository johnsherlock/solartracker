import { describe, it, expect } from 'vitest';
import { normaliseEddiRecords } from '../adapter';
import { localMidnightUtc } from '../client';
import type { EddiRecord } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<EddiRecord> & { yr: number; mon: number; dom: number }): EddiRecord {
  return { hsk: 300, v1: 2400, frq: 5000, ...overrides };
}

// Build a synthetic full day of records in UTC for a given UTC date range.
// startUtcMs: UTC epoch of the first record (= local midnight for the requested day)
// count: number of 1-minute records to generate
function buildRecords(startUtcMs: number, count: number, extraFields?: Partial<EddiRecord>): EddiRecord[] {
  const records: EddiRecord[] = [];
  for (let i = 0; i < count; i++) {
    const ts = startUtcMs + i * 60_000;
    const d = new Date(ts);
    records.push(makeRecord({
      yr: d.getUTCFullYear(),
      mon: d.getUTCMonth() + 1,
      dom: d.getUTCDate(),
      hr: d.getUTCHours() || undefined,    // omit when 0 (matches real API)
      min: d.getUTCMinutes() || undefined,  // omit when 0
      imp: 36000,
      ...extraFields,
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------
// localMidnightUtc
// ---------------------------------------------------------------------------

describe('localMidnightUtc', () => {
  it('returns UTC midnight for a winter GMT day (offset 0)', () => {
    // 2026-01-15 in Europe/Dublin = UTC midnight
    const result = localMidnightUtc('2026-01-15', 'Europe/Dublin');
    expect(new Date(result).toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('returns UTC 23:00 previous day for a summer BST day (offset +1)', () => {
    // 2026-07-01 in Europe/Dublin (BST = UTC+1); local midnight = UTC 2026-06-30T23:00Z
    const result = localMidnightUtc('2026-07-01', 'Europe/Dublin');
    expect(new Date(result).toISOString()).toBe('2026-06-30T23:00:00.000Z');
  });

  it('returns correct UTC start for DST spring-forward day (2026-03-29)', () => {
    // 2026-03-29: clocks go forward at 01:00 UTC → 02:00 BST
    // Local midnight on this day starts at UTC 00:00 (still GMT at midnight)
    const result = localMidnightUtc('2026-03-29', 'Europe/Dublin');
    expect(new Date(result).toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('returns correct UTC start for DST fall-back day (2026-10-25)', () => {
    // 2026-10-25: clocks go back at 02:00 BST (01:00 UTC) → 01:00 GMT
    // Local midnight is 2026-10-24T23:00Z (still in BST at local midnight)
    const result = localMidnightUtc('2026-10-25', 'Europe/Dublin');
    expect(new Date(result).toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// normaliseEddiRecords — normal day
// ---------------------------------------------------------------------------

describe('normaliseEddiRecords — normal winter day', () => {
  const timezone = 'Europe/Dublin';
  const date = '2026-01-15';
  // UTC midnight = local midnight for a winter GMT day
  const startUtc = localMidnightUtc(date, timezone);

  it('produces one MinuteReading per minute for a full day', () => {
    // 1441 records (1440 day + 1 boundary)
    const records = buildRecords(startUtc, 1441);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(1440);
  });

  it('filters out the boundary record at the start of the next day', () => {
    const records = buildRecords(startUtc, 1441);
    const result = normaliseEddiRecords(records, date, timezone);
    const last = result[result.length - 1];
    expect(last.hour).toBe(23);
    expect(last.minute).toBe(59);
  });

  it('maps hr/min to local time correctly', () => {
    const records = buildRecords(startUtc, 5);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0]).toMatchObject({ hour: 0, minute: 0 });
    expect(result[1]).toMatchObject({ hour: 0, minute: 1 });
    expect(result[4]).toMatchObject({ hour: 0, minute: 4 });
  });

  it('converts Joules to kWh correctly', () => {
    const records = [makeRecord({
      yr: 2026, mon: 1, dom: 15,
      imp: 3_600_000,   // 1 kWh
      gep: 1_800_000,   // 0.5 kWh
      exp: 900_000,     // 0.25 kWh
      h1d: 360_000,     // 0.1 kWh
    })];
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0].importKwh).toBeCloseTo(1.0);
    expect(result[0].generatedKwh).toBeCloseTo(0.5);
    expect(result[0].exportKwh).toBeCloseTo(0.25);
    expect(result[0].immersionDivertedKwh).toBeCloseTo(0.1);
  });

  it('defaults absent energy fields to 0', () => {
    const records = [makeRecord({ yr: 2026, mon: 1, dom: 15 })]; // no energy fields
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0].importKwh).toBe(0);
    expect(result[0].generatedKwh).toBe(0);
    expect(result[0].exportKwh).toBe(0);
    expect(result[0].immersionDivertedKwh).toBe(0);
    expect(result[0].immersionBoostedKwh).toBe(0);
  });

  it('uses gep for generatedKwh, not gen', () => {
    const records = [makeRecord({
      yr: 2026, mon: 1, dom: 15,
      gen: 120,      // noise — should be ignored
      gep: 7_200_000, // 2 kWh — should be used
    })];
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0].generatedKwh).toBeCloseTo(2.0);
  });

  it('returns 0 generatedKwh when only gen is present (no gep)', () => {
    const records = [makeRecord({ yr: 2026, mon: 1, dom: 15, gen: 120 })];
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0].generatedKwh).toBe(0);
  });

  it('derives consumed as import + generated - export - immersionDiverted', () => {
    const records = [makeRecord({
      yr: 2026, mon: 1, dom: 15,
      imp: 3_600_000,  // 1 kWh
      gep: 1_800_000,  // 0.5 kWh
      exp: 360_000,    // 0.1 kWh
      h1d: 180_000,    // 0.05 kWh
    })];
    const result = normaliseEddiRecords(records, date, timezone);
    // consumed = 1 + 0.5 - 0.1 - 0.05 = 1.35
    expect(result[0].consumedKwh).toBeCloseTo(1.35);
  });

  it('clamps consumedKwh to 0 when derived value is negative', () => {
    const records = [makeRecord({
      yr: 2026, mon: 1, dom: 15,
      imp: 0,
      gep: 0,
      exp: 3_600_000, // large export → negative consumed
    })];
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0].consumedKwh).toBe(0);
  });

  it('returns empty array for an empty records list', () => {
    expect(normaliseEddiRecords([], date, timezone)).toEqual([]);
  });

  it('returns empty array when all records fall outside the requested date', () => {
    // All records on the wrong day
    const wrongDay = buildRecords(startUtc - 86_400_000, 60); // previous day UTC
    const result = normaliseEddiRecords(wrongDay, date, timezone);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normaliseEddiRecords — BST day (UTC offset +1)
// ---------------------------------------------------------------------------

describe('normaliseEddiRecords — BST summer day', () => {
  const timezone = 'Europe/Dublin';
  const date = '2026-07-01';
  // local midnight BST = UTC 2026-06-30T23:00Z
  const startUtc = localMidnightUtc(date, timezone);

  it('correctly maps UTC 23:00 June 30 → local 00:00 July 1', () => {
    const records = buildRecords(startUtc, 5);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[0]).toMatchObject({ hour: 0, minute: 0 });
    expect(result[1]).toMatchObject({ hour: 0, minute: 1 });
  });

  it('produces 1440 records for a full BST day', () => {
    const records = buildRecords(startUtc, 1441);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(1440);
  });

  it('last record is local 23:59', () => {
    const records = buildRecords(startUtc, 1441);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result[result.length - 1]).toMatchObject({ hour: 23, minute: 59 });
  });
});

// ---------------------------------------------------------------------------
// normaliseEddiRecords — DST spring-forward (2026-03-29, Europe/Dublin)
// Clocks go forward at 01:00 UTC → 02:00 BST; local 01:xx does not exist.
// Day has 23 hours = 1380 minutes.
// ---------------------------------------------------------------------------

describe('normaliseEddiRecords — DST spring-forward day (2026-03-29)', () => {
  const timezone = 'Europe/Dublin';
  const date = '2026-03-29';
  const startUtc = localMidnightUtc(date, timezone); // UTC 2026-03-29T00:00Z

  it('produces 1380 records (23-hour day, missing local 01:xx)', () => {
    const records = buildRecords(startUtc, 1500);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(1380);
  });

  it('local time jumps from 00:59 to 02:00 (no 01:xx records)', () => {
    const records = buildRecords(startUtc, 1500);
    const result = normaliseEddiRecords(records, date, timezone);
    const times = result.map((r) => `${r.hour}:${String(r.minute).padStart(2, '0')}`);
    expect(times).not.toContain('1:00');
    expect(times).toContain('0:59');
    expect(times).toContain('2:00');
  });
});

// ---------------------------------------------------------------------------
// normaliseEddiRecords — DST fall-back (2026-10-25, Europe/Dublin)
// Clocks go back at 02:00 BST (01:00 UTC) → 01:00 GMT; local 01:xx repeats.
// Day has 25 hours = 1500 minutes.
// ---------------------------------------------------------------------------

describe('normaliseEddiRecords — DST fall-back day (2026-10-25)', () => {
  const timezone = 'Europe/Dublin';
  const date = '2026-10-25';
  const startUtc = localMidnightUtc(date, timezone); // UTC 2026-10-24T23:00Z

  it('produces 1500 records (25-hour day, local 01:xx appears twice)', () => {
    const records = buildRecords(startUtc, 1501);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(1500);
  });

  it('local 01:00 appears twice in the output', () => {
    const records = buildRecords(startUtc, 1501);
    const result = normaliseEddiRecords(records, date, timezone);
    const oneOclocks = result.filter((r) => r.hour === 1 && r.minute === 0);
    expect(oneOclocks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// normaliseEddiRecords — sparse / partial day
// ---------------------------------------------------------------------------

describe('normaliseEddiRecords — sparse payload', () => {
  const timezone = 'Europe/Dublin';
  const date = '2026-04-03';
  const startUtc = localMidnightUtc(date, timezone);

  it('handles a payload with only a few records', () => {
    const records = buildRecords(startUtc, 10);
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(10);
  });

  it('handles records that are missing hr and min fields', () => {
    // Simulate the API omitting hr:0 and min:0 on some records
    const records: EddiRecord[] = [
      makeRecord({ yr: 2026, mon: 4, dom: 2, hr: 23, imp: 10000 }), // UTC 23:00 = BST 00:00 April 3
      makeRecord({ yr: 2026, mon: 4, dom: 3, imp: 10000 }),           // UTC 00:00 = BST 01:00 April 3 (hr and min absent)
    ];
    const result = normaliseEddiRecords(records, date, timezone);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ hour: 0, minute: 0 });
    expect(result[1]).toMatchObject({ hour: 1, minute: 0 });
  });
});
