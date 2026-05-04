/**
 * Pure layout utilities for the yearly GitHub-style heat map.
 * No React dependencies — fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Full-year gate
// ---------------------------------------------------------------------------

/**
 * Returns true only when the range spans exactly one full calendar year:
 * from = YYYY-01-01 and to = YYYY-12-31 (same year).
 */
export function isFullCalendarYear(from: string, to: string): boolean {
  if (from.length !== 10 || to.length !== 10) return false;
  const year = from.slice(0, 4);
  if (to.slice(0, 4) !== year) return false;
  return from.slice(5) === '01-01' && to.slice(5) === '12-31';
}

// ---------------------------------------------------------------------------
// Cell layout
// ---------------------------------------------------------------------------

export type HeatMapCell = {
  /** YYYY-MM-DD */
  date: string;
  /** 0-based week column, anchored to the Monday on or before 1 Jan */
  col: number;
  /** 0-based day-of-week row: 0 = Mon … 6 = Sun */
  row: number;
};

/** Formats a Date as YYYY-MM-DD using local calendar fields, avoiding UTC shift. */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the ISO day-of-week (0=Mon … 6=Sun) for a given date string.
 * JS getDay() returns 0=Sun, so we rotate.
 */
function isoDow(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  return (d.getDay() + 6) % 7; // Sun→6, Mon→0
}

/**
 * Returns one HeatMapCell for every valid calendar date in the given year.
 * col is the 0-based week index measured from the Monday on or before Jan 1.
 * row is the ISO day-of-week (0=Mon, 6=Sun).
 */
export function buildHeatMapCells(year: number): HeatMapCell[] {
  const jan1 = `${year}-01-01`;
  const jan1Dow = isoDow(jan1); // 0=Mon offset of first day (= days from week anchor to Jan 1)

  const cells: HeatMapCell[] = [];

  const endDate = new Date(`${year}-12-31T12:00:00`);
  const startDate = new Date(`${jan1}T12:00:00`);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const iso = localISODate(d);
    const daysSinceJan1 = Math.round((d.getTime() - startDate.getTime()) / 86_400_000);
    const daysSinceWeekAnchor = daysSinceJan1 + jan1Dow;
    cells.push({
      date: iso,
      col: Math.floor(daysSinceWeekAnchor / 7),
      row: daysSinceWeekAnchor % 7,
    });
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Month labels
// ---------------------------------------------------------------------------

export type MonthLabel = {
  /** 1-based month number */
  month: number;
  label: string;
  /** Column index where the first day of this month falls */
  col: number;
};

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Returns the column position of the first day of each month in the year,
 * using the same column layout as buildHeatMapCells.
 */
export function buildMonthLabels(year: number): MonthLabel[] {
  const jan1 = `${year}-01-01`;
  const jan1Dow = isoDow(jan1);
  const startDate = new Date(`${jan1}T12:00:00`);

  return MONTH_ABBR.map((label, i) => {
    const month = i + 1;
    const firstOfMonth = new Date(year, i, 1);
    const daysSinceJan1 = Math.round((firstOfMonth.getTime() - startDate.getTime()) / 86_400_000);
    const daysSinceWeekAnchor = daysSinceJan1 + jan1Dow;
    const col = Math.floor(daysSinceWeekAnchor / 7);
    return { month, label, col };
  });
}

// ---------------------------------------------------------------------------
// Total column count
// ---------------------------------------------------------------------------

/** Number of week columns required to display the full year. */
export function totalColumns(year: number): number {
  const dec31 = `${year}-12-31`;
  const jan1 = `${year}-01-01`;
  const jan1Dow = isoDow(jan1);
  const startDate = new Date(`${jan1}T12:00:00`);
  const endDate = new Date(`${dec31}T12:00:00`);
  const daysSinceJan1 = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  return Math.floor((daysSinceJan1 + jan1Dow) / 7) + 1;
}

// ---------------------------------------------------------------------------
// Navigation URL builders — pure functions so they can be unit-tested
// ---------------------------------------------------------------------------

/** URL for the Historical Day screen for a given date. */
export function buildHistoryDayUrl(date: string): string {
  return `/history/${date}`;
}

/** URL for the Calendar View for a given year. */
export function buildCalendarYearUrl(year: number): string {
  return `/calendar?year=${year}`;
}
