/**
 * Period preset definitions for the Range History screen.
 *
 * Presets map to a date window applied client-side over the loaded dataset.
 * No re-fetch occurs when switching presets — only the zoom window changes
 * (except for "All" mode which may trigger a server reload via URL param).
 */

// ---------------------------------------------------------------------------
// Legacy exports — kept for any existing usages
// ---------------------------------------------------------------------------

export type RangePreset =
  | 'last-7-days'
  | 'last-30-days'
  | 'last-3-months'
  | 'last-12-months'
  | 'last-year'
  | 'this-month'
  | 'this-year';

export type PresetWindow = {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
};

export const PRESET_LABELS: Record<RangePreset, string> = {
  'last-7-days': 'Last 7 days',
  'last-30-days': 'Last 30 days',
  'last-3-months': 'Last 3 months',
  'last-12-months': 'Last 12 months',
  'last-year': 'Last year',
  'this-month': 'This month',
  'this-year': 'This year',
};

export const PRESET_ORDER: RangePreset[] = [
  'last-7-days',
  'last-30-days',
  'last-3-months',
  'last-12-months',
  'last-year',
  'this-month',
  'this-year',
];

export const DEFAULT_PRESET: RangePreset = 'last-30-days';

export function computePresetWindow(preset: RangePreset, today: string): PresetWindow {
  const toDate = new Date(`${today}T12:00:00`);

  switch (preset) {
    case 'last-7-days': {
      const from = _offsetDate(toDate, -6);
      return { from, to: today };
    }
    case 'last-30-days': {
      const from = _offsetDate(toDate, -29);
      return { from, to: today };
    }
    case 'last-3-months': {
      const from = _offsetDate(toDate, -89);
      return { from, to: today };
    }
    case 'last-12-months': {
      const from = _offsetDate(toDate, -364);
      return { from, to: today };
    }
    case 'last-year': {
      const prevYear = String(parseInt(today.split('-')[0]) - 1);
      return { from: `${prevYear}-01-01`, to: `${prevYear}-12-31` };
    }
    case 'this-month': {
      const [year, month] = today.split('-');
      const from = `${year}-${month}-01`;
      return { from, to: today };
    }
    case 'this-year': {
      const [year] = today.split('-');
      const from = `${year}-01-01`;
      return { from, to: today };
    }
  }
}

export function loadedWindowStart(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 364);
  return d.toISOString().slice(0, 10);
}

export function clampToLoadedWindow(from: string, to: string, today: string): PresetWindow {
  const windowStart = loadedWindowStart(today);
  return {
    from: from < windowStart ? windowStart : from,
    to: to > today ? today : to,
  };
}

export function formatCustomWindowLabel(from: string, to: string): string {
  const [fromYear] = from.split('-');
  const [toYear] = to.split('-');
  const toLabel = _fmtLong(to);
  if (fromYear === toYear) {
    return `${_fmtShort(from)} – ${toLabel}`;
  }
  return `${_fmtLong(from)} – ${toLabel}`;
}

// ---------------------------------------------------------------------------
// Advanced range picker types
// ---------------------------------------------------------------------------

/** Selection mode for the advanced range picker. */
export type RangeMode = 'custom' | 'weeks' | 'months' | 'years' | 'all';

/**
 * The shared active-range state used by the period bar, picker popover,
 * and chart zoom sync.
 */
export type ActiveRange = {
  mode: RangeMode;
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
};

/** Default range: last 30 days in custom mode (computed at call time). */
export function defaultActiveRange(today: string): ActiveRange {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 29);
  return {
    mode: 'custom',
    from: d.toISOString().slice(0, 10),
    to: today,
  };
}

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

/**
 * Returns the period-bar label for the active range.
 *
 * | Mode | Example |
 * |------|---------|
 * | custom | `10 Apr – 20 Apr 2025` |
 * | weeks  | `6 – 12 Apr 2026` |
 * | months | `Apr 2026` |
 * | years  | `2026` |
 * | all    | `All` |
 */
export function formatRangeLabel(range: ActiveRange): string {
  if (range.mode === 'all') return 'All';

  if (range.mode === 'years') {
    return range.from.slice(0, 4);
  }

  if (range.mode === 'months') {
    return new Intl.DateTimeFormat('en-IE', { month: 'short', year: 'numeric' }).format(
      new Date(`${range.from}T12:00:00`),
    );
  }

  // weeks and custom: show date range
  const [fromYear] = range.from.split('-');
  const [toYear] = range.to.split('-');
  if (range.from === range.to) {
    return _fmtLong(range.from);
  }
  const toLabel = _fmtLong(range.to);
  if (fromYear === toYear) {
    return `${_fmtShort(range.from)} – ${toLabel}`;
  }
  return `${_fmtLong(range.from)} – ${toLabel}`;
}

// ---------------------------------------------------------------------------
// Calendar boundary helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Sun–Sat week that contains `date` (YYYY-MM-DD).
 * Sunday is treated as the first day of the week.
 */
export function weekContaining(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00`);
  const dow = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  // Sunday-start: subtract dow to reach Sunday
  const sun = new Date(d);
  sun.setDate(d.getDate() - dow);
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return {
    from: _isoFromLocal(sun),
    to: _isoFromLocal(sat),
  };
}

/**
 * Returns the first and last day of the calendar month for the given
 * year (number) and month (0-based).
 */
export function calendarMonthBounds(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const yyyy = String(year);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return {
    from: `${yyyy}-${mm}-01`,
    to: `${yyyy}-${mm}-${dd}`,
  };
}

/**
 * Returns Jan 1 – Dec 31 for the given year.
 */
export function yearBounds(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

// ---------------------------------------------------------------------------
// Chevron step logic
// ---------------------------------------------------------------------------

/**
 * Advance the range forward by one unit (week, month, year, or custom width).
 * Clamped to today.
 */
export function stepRangeForward(range: ActiveRange, today: string): ActiveRange {
  if (range.mode === 'all') return range;

  if (range.mode === 'months') {
    const d = new Date(`${range.from}T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const { from, to } = calendarMonthBounds(year, month);
    return { mode: 'months', from, to: to > today ? today : to };
  }

  if (range.mode === 'years') {
    const year = parseInt(range.from.slice(0, 4)) + 1;
    const { from, to } = yearBounds(year);
    return { mode: 'years', from, to: to > today ? today : to };
  }

  // custom and weeks: shift by window width
  const stepDays = range.mode === 'weeks' ? 7 : _daysBetween(range.from, range.to) + 1;
  const newFrom = _offsetIso(range.from, stepDays);
  const newTo = _offsetIso(range.to, stepDays);
  if (newFrom > today) return range;
  return {
    mode: range.mode,
    from: newFrom,
    to: newTo > today ? today : newTo,
  };
}

/**
 * Shift the range backward by one unit.
 * Clamped to earliestDate (or very far back if null).
 */
export function stepRangeBackward(
  range: ActiveRange,
  earliestDate: string | null,
): ActiveRange {
  if (range.mode === 'all') return range;

  const floor = earliestDate ?? '2000-01-01';

  if (range.mode === 'months') {
    const d = new Date(`${range.from}T12:00:00`);
    d.setMonth(d.getMonth() - 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const { from, to } = calendarMonthBounds(year, month);
    return { mode: 'months', from: from < floor ? floor : from, to };
  }

  if (range.mode === 'years') {
    const year = parseInt(range.from.slice(0, 4)) - 1;
    const { from, to } = yearBounds(year);
    return { mode: 'years', from: from < floor ? floor : from, to };
  }

  const stepDays = range.mode === 'weeks' ? 7 : _daysBetween(range.from, range.to) + 1;
  const newFrom = _offsetIso(range.from, -stepDays);
  const newTo = _offsetIso(range.to, -stepDays);
  if (newTo < floor) return range;
  return {
    mode: range.mode,
    from: newFrom < floor ? floor : newFrom,
    to: newTo,
  };
}

/**
 * True when stepping forward is not possible (already at or past today).
 */
export function isStepForwardDisabled(range: ActiveRange, today: string): boolean {
  if (range.mode === 'all') return true;
  return range.to >= today;
}

/**
 * True when stepping backward is not possible (already at or before earliestDate).
 */
export function isStepBackwardDisabled(
  range: ActiveRange,
  earliestDate: string | null,
): boolean {
  if (range.mode === 'all') return true;
  if (!earliestDate) return false;
  return range.from <= earliestDate;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Format a Date using local date components to avoid UTC offset shifts in UTC+ zones. */
function _isoFromLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _offsetDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function _offsetIso(iso: string, days: number): string {
  return _offsetDate(new Date(`${iso}T12:00:00`), days);
}

function _daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function _fmtLong(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
}

function _fmtShort(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${iso}T12:00:00`));
}
