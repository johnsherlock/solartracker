/**
 * Period preset definitions for the Range History screen.
 *
 * Presets map to a date window applied client-side over the loaded 365-day
 * dataset. No re-fetch occurs when switching presets — only the zoom window
 * changes.
 */

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

/**
 * Computes the from/to window for a named preset relative to a given today
 * date (YYYY-MM-DD). The to date is always today.
 */
export function computePresetWindow(preset: RangePreset, today: string): PresetWindow {
  const toDate = new Date(`${today}T12:00:00`);

  switch (preset) {
    case 'last-7-days': {
      const from = offsetDate(toDate, -6);
      return { from, to: today };
    }
    case 'last-30-days': {
      const from = offsetDate(toDate, -29);
      return { from, to: today };
    }
    case 'last-3-months': {
      const from = offsetDate(toDate, -89);
      return { from, to: today };
    }
    case 'last-12-months': {
      const from = offsetDate(toDate, -364);
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

function offsetDate(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the earliest date in the 365-day loaded window (today - 364 days).
 */
export function loadedWindowStart(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 364);
  return d.toISOString().slice(0, 10);
}

/**
 * Clamps a custom date range to the loaded 365-day window.
 */
export function clampToLoadedWindow(
  from: string,
  to: string,
  today: string,
): PresetWindow {
  const windowStart = loadedWindowStart(today);
  return {
    from: from < windowStart ? windowStart : from,
    to: to > today ? today : to,
  };
}

/**
 * Formats a custom window as a human-readable label, e.g. "12 Mar – 6 Apr 2025".
 */
export function formatCustomWindowLabel(from: string, to: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${iso}T12:00:00`),
    );
  const fromLabel = fmt(from);
  const toLabel = fmt(to);
  // If same year, omit year from the from part
  const [fromYear] = from.split('-');
  const [toYear] = to.split('-');
  if (fromYear === toYear) {
    const fromShort = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'short' }).format(
      new Date(`${from}T12:00:00`),
    );
    return `${fromShort} – ${toLabel}`;
  }
  return `${fromLabel} – ${toLabel}`;
}
