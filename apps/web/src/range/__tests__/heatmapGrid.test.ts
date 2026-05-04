import { describe, it, expect } from 'vitest';
import {
  isFullCalendarYear,
  buildHeatMapCells,
  buildMonthLabels,
  totalColumns,
  buildHistoryDayUrl,
  buildCalendarYearUrl,
} from '../heatmapGrid';

// ---------------------------------------------------------------------------
// isFullCalendarYear
// ---------------------------------------------------------------------------

describe('isFullCalendarYear', () => {
  it('accepts a full past year', () => {
    expect(isFullCalendarYear('2024-01-01', '2024-12-31')).toBe(true);
  });

  it('accepts a full year set to current year end', () => {
    expect(isFullCalendarYear('2026-01-01', '2026-12-31')).toBe(true);
  });

  it('rejects a partial current year (to = today)', () => {
    expect(isFullCalendarYear('2026-01-01', '2026-05-03')).toBe(false);
  });

  it('rejects a range spanning two years', () => {
    expect(isFullCalendarYear('2024-01-01', '2025-12-31')).toBe(false);
  });

  it('rejects a single month range', () => {
    expect(isFullCalendarYear('2024-01-01', '2024-01-31')).toBe(false);
  });

  it('rejects a range not starting on Jan 1', () => {
    expect(isFullCalendarYear('2024-02-01', '2024-12-31')).toBe(false);
  });

  it('rejects a range not ending on Dec 31', () => {
    expect(isFullCalendarYear('2024-01-01', '2024-11-30')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildHeatMapCells
// ---------------------------------------------------------------------------

describe('buildHeatMapCells', () => {
  // 2024-01-01 is a Monday (ISO dow = 0) → col 0, row 0
  it('places 2024-01-01 (Monday) at col=0, row=0', () => {
    const cells = buildHeatMapCells(2024);
    const jan1 = cells.find((c) => c.date === '2024-01-01');
    expect(jan1).toBeDefined();
    expect(jan1!.col).toBe(0);
    expect(jan1!.row).toBe(0);
  });

  it('places 2024-01-07 (Sunday) at col=0, row=6', () => {
    const cells = buildHeatMapCells(2024);
    const jan7 = cells.find((c) => c.date === '2024-01-07');
    expect(jan7!.col).toBe(0);
    expect(jan7!.row).toBe(6);
  });

  it('places 2024-01-08 (Monday) at col=1, row=0', () => {
    const cells = buildHeatMapCells(2024);
    const jan8 = cells.find((c) => c.date === '2024-01-08');
    expect(jan8!.col).toBe(1);
    expect(jan8!.row).toBe(0);
  });

  it('includes all 366 days for leap year 2024', () => {
    const cells = buildHeatMapCells(2024);
    expect(cells).toHaveLength(366);
  });

  it('includes leap day 2024-02-29', () => {
    const cells = buildHeatMapCells(2024);
    const feb29 = cells.find((c) => c.date === '2024-02-29');
    expect(feb29).toBeDefined();
  });

  it('includes all 365 days for non-leap year 2025', () => {
    const cells = buildHeatMapCells(2025);
    expect(cells).toHaveLength(365);
  });

  // 2025-01-01 is a Wednesday (ISO dow = 2)
  it('places 2025-01-01 (Wednesday) at col=0, row=2', () => {
    const cells = buildHeatMapCells(2025);
    const jan1 = cells.find((c) => c.date === '2025-01-01');
    expect(jan1!.col).toBe(0);
    expect(jan1!.row).toBe(2);
  });

  it('places 2025-01-06 (Monday) at col=1, row=0', () => {
    const cells = buildHeatMapCells(2025);
    const jan6 = cells.find((c) => c.date === '2025-01-06');
    expect(jan6!.col).toBe(1);
    expect(jan6!.row).toBe(0);
  });

  it('places Dec 31 in the last column', () => {
    const cells = buildHeatMapCells(2024);
    const dec31 = cells.find((c) => c.date === '2024-12-31');
    const maxCol = Math.max(...cells.map((c) => c.col));
    expect(dec31!.col).toBe(maxCol);
  });
});

// ---------------------------------------------------------------------------
// buildMonthLabels
// ---------------------------------------------------------------------------

describe('buildMonthLabels', () => {
  it('returns 12 labels', () => {
    expect(buildMonthLabels(2024)).toHaveLength(12);
  });

  it('Jan label is at col=0 for 2024 (starts on Monday)', () => {
    const labels = buildMonthLabels(2024);
    expect(labels[0].label).toBe('Jan');
    expect(labels[0].col).toBe(0);
  });

  it('Feb label col is > 0', () => {
    const labels = buildMonthLabels(2024);
    expect(labels[1].label).toBe('Feb');
    expect(labels[1].col).toBeGreaterThan(0);
  });

  it('labels are in ascending column order', () => {
    const labels = buildMonthLabels(2024);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].col).toBeGreaterThanOrEqual(labels[i - 1].col);
    }
  });

  it('all month names are present', () => {
    const labels = buildMonthLabels(2024).map((l) => l.label);
    expect(labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });
});

// ---------------------------------------------------------------------------
// totalColumns
// ---------------------------------------------------------------------------

describe('totalColumns', () => {
  it('returns 53 for 2024 (leap year, starts Monday)', () => {
    // 366 days, Jan 1 is Mon → 366 days / 7 = 52.28 → 53 columns
    expect(totalColumns(2024)).toBe(53);
  });

  it('returns 53 for 2025 (starts Wednesday)', () => {
    // 365 days, 2-day offset → 367 / 7 = 52.4 → 53 columns
    expect(totalColumns(2025)).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// Navigation URL builders
// ---------------------------------------------------------------------------

describe('buildHistoryDayUrl', () => {
  it('builds the expected history day path', () => {
    expect(buildHistoryDayUrl('2024-08-07')).toBe('/history/2024-08-07');
  });

  it('preserves the date string exactly', () => {
    expect(buildHistoryDayUrl('2023-01-01')).toBe('/history/2023-01-01');
  });
});

describe('buildCalendarYearUrl', () => {
  it('builds the expected calendar year URL', () => {
    expect(buildCalendarYearUrl(2024)).toBe('/calendar?year=2024');
  });

  it('targets the correct year for a partial current year', () => {
    expect(buildCalendarYearUrl(2026)).toBe('/calendar?year=2026');
  });
});

// ---------------------------------------------------------------------------
// Timezone safety — cell dates must be local calendar dates
// ---------------------------------------------------------------------------

describe('buildHeatMapCells timezone safety', () => {
  it('emits only dates within the requested year', () => {
    const cells = buildHeatMapCells(2024);
    for (const { date } of cells) {
      expect(date.slice(0, 4)).toBe('2024');
    }
  });

  it('first cell date is Jan 1 and last is Dec 31', () => {
    const cells = buildHeatMapCells(2024);
    expect(cells[0].date).toBe('2024-01-01');
    expect(cells[cells.length - 1].date).toBe('2024-12-31');
  });

  it('no duplicate dates', () => {
    const cells = buildHeatMapCells(2024);
    const dates = cells.map((c) => c.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
