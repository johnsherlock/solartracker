import { describe, it, expect } from 'vitest';
import {
  applyViewMode,
  applyCostViewMode,
  formatClockTime,
  formatKwh,
  formatKw,
  formatEuro,
  formatSeriesLabel,
  formatCostSeriesLabel,
  addDays,
  shiftMonth,
  type SeriesKey,
} from '../chartUtils';
import type { LivePoint, CostPoint } from '../loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePoint(
  time: string,
  overrides: Partial<Omit<LivePoint, 'time'>> = {},
): LivePoint {
  return {
    time,
    generation: 0,
    consumption: 0,
    import: 0,
    export: 0,
    immersion: 0,
    intervalHours: 0.5,
    ...overrides,
  };
}

function makeCostPoint(time: string, overrides: Partial<Omit<CostPoint, 'time'>> = {}): CostPoint {
  return {
    time,
    importCost: 0,
    savings: 0,
    exportCredit: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyViewMode
// ---------------------------------------------------------------------------

describe('applyViewMode', () => {
  it('returns data unchanged in line mode', () => {
    const data = [
      makePoint('09:00', { generation: 1.5, consumption: 1.0 }),
      makePoint('09:30', { generation: 2.0, consumption: 1.2 }),
    ];
    const result = applyViewMode(data, 'line', '30min');
    expect(result).toEqual(data);
  });

  it('accumulates values in cumulative mode for 30min resolution', () => {
    const data = [
      makePoint('09:00', { generation: 2, consumption: 1, import: 0, export: 0.5, immersion: 0, intervalHours: 0.5 }),
      makePoint('09:30', { generation: 2, consumption: 1, import: 0, export: 0.5, immersion: 0, intervalHours: 0.5 }),
    ];
    const result = applyViewMode(data, 'cumulative', '30min');

    // First point: each value * 0.5 intervalHours
    expect(result[0].generation).toBe(1);
    expect(result[0].consumption).toBe(0.5);
    expect(result[0].export).toBe(0.25);

    // Second point: running total adds another 0.5 * each value
    expect(result[1].generation).toBe(2);
    expect(result[1].consumption).toBe(1);
    expect(result[1].export).toBe(0.5);
  });

  it('uses factor 1 for 1min resolution in cumulative mode', () => {
    const data = [
      makePoint('09:00', { generation: 0.5, consumption: 0.3, import: 0, export: 0, immersion: 0, intervalHours: 1 / 60 }),
      makePoint('09:01', { generation: 0.5, consumption: 0.3, import: 0, export: 0, immersion: 0, intervalHours: 1 / 60 }),
    ];
    const result = applyViewMode(data, 'cumulative', '1min');

    // Factor for 1min is always 1, not intervalHours
    expect(result[0].generation).toBe(0.5);
    expect(result[1].generation).toBe(1.0);
  });

  it('preserves time and intervalHours fields', () => {
    const data = [makePoint('10:00', { intervalHours: 0.5 })];
    const result = applyViewMode(data, 'cumulative', '30min');
    expect(result[0].time).toBe('10:00');
    expect(result[0].intervalHours).toBe(0.5);
  });

  it('returns empty array unchanged', () => {
    expect(applyViewMode([], 'cumulative', '30min')).toEqual([]);
    expect(applyViewMode([], 'line', '1min')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyCostViewMode
// ---------------------------------------------------------------------------

describe('applyCostViewMode', () => {
  it('returns data unchanged in line mode', () => {
    const data = [
      makeCostPoint('09:00', { importCost: 0.5, savings: 0.1, exportCredit: 0.05 }),
    ];
    expect(applyCostViewMode(data, 'line')).toEqual(data);
  });

  it('accumulates cost values in cumulative mode', () => {
    const data = [
      makeCostPoint('09:00', { importCost: 0.1, savings: 0.05, exportCredit: 0.02 }),
      makeCostPoint('09:30', { importCost: 0.1, savings: 0.05, exportCredit: 0.02 }),
      makeCostPoint('10:00', { importCost: 0.2, savings: 0.1, exportCredit: 0.04 }),
    ];
    const result = applyCostViewMode(data, 'cumulative');

    expect(result[0].importCost).toBe(0.1);
    expect(result[1].importCost).toBe(0.2);
    expect(result[2].importCost).toBe(0.4);

    expect(result[0].savings).toBe(0.05);
    expect(result[1].savings).toBe(0.1);
    expect(result[2].savings).toBe(0.2);
  });

  it('preserves the time field', () => {
    const data = [makeCostPoint('12:30', { importCost: 1 })];
    expect(applyCostViewMode(data, 'cumulative')[0].time).toBe('12:30');
  });

  it('returns empty array unchanged', () => {
    expect(applyCostViewMode([], 'cumulative')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatClockTime
// ---------------------------------------------------------------------------

describe('formatClockTime', () => {
  it('formats a known UTC date correctly in Europe/Dublin (winter, no DST offset)', () => {
    // 2024-01-15 14:30:45 UTC — Dublin is UTC+0 in winter
    const date = new Date('2024-01-15T14:30:45Z');
    const result = formatClockTime(date, 'Europe/Dublin');
    expect(result).toBe('14:30:45');
  });

  it('formats a known UTC date correctly in Europe/Dublin (summer, UTC+1)', () => {
    // 2024-07-15 12:00:00 UTC — Dublin is UTC+1 in summer
    const date = new Date('2024-07-15T12:00:00Z');
    const result = formatClockTime(date, 'Europe/Dublin');
    expect(result).toBe('13:00:00');
  });

  it('pads hours and seconds with leading zeros', () => {
    // 2024-01-15 08:05:03 UTC
    const date = new Date('2024-01-15T08:05:03Z');
    const result = formatClockTime(date, 'Europe/Dublin');
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Formatter helpers
// ---------------------------------------------------------------------------

describe('formatKwh', () => {
  it('formats to 2 decimal places with kWh suffix', () => {
    expect(formatKwh(1.5)).toBe('1.50 kWh');
    expect(formatKwh(0)).toBe('0.00 kWh');
    expect(formatKwh(12.345)).toBe('12.35 kWh');
  });
});

describe('formatKw', () => {
  it('formats to 2 decimal places with kW suffix', () => {
    expect(formatKw(2.5)).toBe('2.50 kW');
    expect(formatKw(0.1)).toBe('0.10 kW');
  });
});

describe('formatEuro', () => {
  it('formats positive values with euro sign', () => {
    expect(formatEuro(1.5)).toBe('€1.50');
    expect(formatEuro(0)).toBe('€0.00');
  });

  it('preserves sign when preserveSign is true and value is negative', () => {
    expect(formatEuro(-1.5, true)).toBe('-€1.50');
    expect(formatEuro(-0.01, true)).toBe('-€0.01');
  });

  it('does not show sign when preserveSign is false', () => {
    expect(formatEuro(-1.5, false)).toBe('€1.50');
  });
});

describe('formatSeriesLabel', () => {
  it('capitalises the first letter of each series key', () => {
    const keys: SeriesKey[] = ['generation', 'consumption', 'import', 'export', 'immersion'];
    const expected = ['Generation', 'Consumption', 'Import', 'Export', 'Immersion'];
    keys.forEach((key, i) => {
      expect(formatSeriesLabel(key)).toBe(expected[i]);
    });
  });
});

describe('formatCostSeriesLabel', () => {
  it('returns the correct label for each cost series', () => {
    expect(formatCostSeriesLabel('importCost')).toBe('Import €');
    expect(formatCostSeriesLabel('exportCredit')).toBe('Export €');
    expect(formatCostSeriesLabel('savings')).toBe('Savings €');
  });
});

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-15', 1)).toBe('2024-01-16');
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
  });

  it('subtracts days when negative', () => {
    expect(addDays('2024-01-15', -1)).toBe('2024-01-14');
  });

  it('adding zero returns the same date', () => {
    expect(addDays('2024-03-10', 0)).toBe('2024-03-10');
  });
});

describe('shiftMonth', () => {
  it('shifts forward by one month', () => {
    expect(shiftMonth('2024-01-01', 1)).toBe('2024-02-01');
  });

  it('shifts backward by one month', () => {
    expect(shiftMonth('2024-03-01', -1)).toBe('2024-02-01');
  });

  it('wraps year boundary forward', () => {
    expect(shiftMonth('2024-12-01', 1)).toBe('2025-01-01');
  });

  it('wraps year boundary backward', () => {
    expect(shiftMonth('2024-01-01', -1)).toBe('2023-12-01');
  });
});
