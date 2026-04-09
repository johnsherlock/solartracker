import { describe, expect, it } from 'vitest';
import {
  formatRangeLabel,
  stepRangeForward,
  stepRangeBackward,
  isStepForwardDisabled,
  isStepBackwardDisabled,
  weekContaining,
  calendarMonthBounds,
  yearBounds,
  defaultActiveRange,
  type ActiveRange,
} from '../presets';

// ---------------------------------------------------------------------------
// defaultActiveRange
// ---------------------------------------------------------------------------

describe('defaultActiveRange', () => {
  it('produces a 30-day custom range ending today', () => {
    const r = defaultActiveRange('2026-04-09');
    expect(r.mode).toBe('custom');
    expect(r.to).toBe('2026-04-09');
    expect(r.from).toBe('2026-03-11');
  });
});

// ---------------------------------------------------------------------------
// weekContaining
// ---------------------------------------------------------------------------

describe('weekContaining', () => {
  it('returns Sun–Sat for a Wednesday', () => {
    // 2026-04-08 is a Wednesday
    const { from, to } = weekContaining('2026-04-08');
    expect(from).toBe('2026-04-05'); // Sunday
    expect(to).toBe('2026-04-11');   // Saturday
  });

  it('returns Sun–Sat when given a Sunday', () => {
    // 2026-04-05 is a Sunday
    const { from, to } = weekContaining('2026-04-05');
    expect(from).toBe('2026-04-05');
    expect(to).toBe('2026-04-11');
  });

  it('returns Sun–Sat when given a Saturday', () => {
    // 2026-04-11 is a Saturday
    const { from, to } = weekContaining('2026-04-11');
    expect(from).toBe('2026-04-05');
    expect(to).toBe('2026-04-11');
  });
});

// ---------------------------------------------------------------------------
// calendarMonthBounds
// ---------------------------------------------------------------------------

describe('calendarMonthBounds', () => {
  it('returns first and last day of the month', () => {
    const { from, to } = calendarMonthBounds(2026, 3); // April (0-based)
    expect(from).toBe('2026-04-01');
    expect(to).toBe('2026-04-30');
  });

  it('handles February in a leap year', () => {
    const { from, to } = calendarMonthBounds(2024, 1);
    expect(from).toBe('2024-02-01');
    expect(to).toBe('2024-02-29');
  });

  it('handles February in a non-leap year', () => {
    const { from, to } = calendarMonthBounds(2025, 1);
    expect(from).toBe('2025-02-01');
    expect(to).toBe('2025-02-28');
  });
});

// ---------------------------------------------------------------------------
// yearBounds
// ---------------------------------------------------------------------------

describe('yearBounds', () => {
  it('returns Jan 1 – Dec 31', () => {
    const { from, to } = yearBounds(2025);
    expect(from).toBe('2025-01-01');
    expect(to).toBe('2025-12-31');
  });
});

// ---------------------------------------------------------------------------
// formatRangeLabel
// ---------------------------------------------------------------------------

describe('formatRangeLabel', () => {
  it('returns "All" for all mode', () => {
    const r: ActiveRange = { mode: 'all', from: '2024-01-01', to: '2026-04-09' };
    expect(formatRangeLabel(r)).toBe('All');
  });

  it('returns year string for years mode', () => {
    const r: ActiveRange = { mode: 'years', from: '2025-01-01', to: '2025-12-31' };
    expect(formatRangeLabel(r)).toBe('2025');
  });

  it('returns month+year for months mode', () => {
    const r: ActiveRange = { mode: 'months', from: '2026-04-01', to: '2026-04-30' };
    const label = formatRangeLabel(r);
    expect(label).toMatch(/Apr/);
    expect(label).toMatch(/2026/);
  });

  it('returns date range for custom mode (same year)', () => {
    const r: ActiveRange = { mode: 'custom', from: '2026-04-01', to: '2026-04-30' };
    const label = formatRangeLabel(r);
    expect(label).toMatch(/Apr/);
    expect(label).toMatch(/2026/);
  });

  it('returns date range for weeks mode', () => {
    const r: ActiveRange = { mode: 'weeks', from: '2026-04-06', to: '2026-04-12' };
    const label = formatRangeLabel(r);
    expect(label).toContain('–');
  });
});

// ---------------------------------------------------------------------------
// isStepForwardDisabled
// ---------------------------------------------------------------------------

describe('isStepForwardDisabled', () => {
  it('disabled when to === today', () => {
    const r: ActiveRange = { mode: 'custom', from: '2026-04-01', to: '2026-04-09' };
    expect(isStepForwardDisabled(r, '2026-04-09')).toBe(true);
  });

  it('not disabled when to < today', () => {
    const r: ActiveRange = { mode: 'custom', from: '2026-04-01', to: '2026-04-08' };
    expect(isStepForwardDisabled(r, '2026-04-09')).toBe(false);
  });

  it('always disabled for all mode', () => {
    const r: ActiveRange = { mode: 'all', from: '2024-01-01', to: '2026-04-09' };
    expect(isStepForwardDisabled(r, '2026-04-09')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isStepBackwardDisabled
// ---------------------------------------------------------------------------

describe('isStepBackwardDisabled', () => {
  it('disabled when from === earliestDate', () => {
    const r: ActiveRange = { mode: 'custom', from: '2024-06-01', to: '2024-06-30' };
    expect(isStepBackwardDisabled(r, '2024-06-01')).toBe(true);
  });

  it('not disabled when from > earliestDate', () => {
    const r: ActiveRange = { mode: 'custom', from: '2024-07-01', to: '2024-07-31' };
    expect(isStepBackwardDisabled(r, '2024-06-01')).toBe(false);
  });

  it('always disabled for all mode', () => {
    const r: ActiveRange = { mode: 'all', from: '2024-01-01', to: '2026-04-09' };
    expect(isStepBackwardDisabled(r, '2024-01-01')).toBe(true);
  });

  it('not disabled when earliestDate is null', () => {
    const r: ActiveRange = { mode: 'custom', from: '2024-01-01', to: '2024-01-31' };
    expect(isStepBackwardDisabled(r, null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stepRangeForward
// ---------------------------------------------------------------------------

describe('stepRangeForward', () => {
  const today = '2026-04-09';

  it('shifts custom range by window width', () => {
    const r: ActiveRange = { mode: 'custom', from: '2026-03-01', to: '2026-03-31' }; // 31 days
    const next = stepRangeForward(r, today);
    expect(next.mode).toBe('custom');
    expect(next.from).toBe('2026-04-01');
    // to is clamped to today
    expect(next.to <= today).toBe(true);
  });

  it('shifts weeks by 7 days', () => {
    // Sun 2026-03-29 – Sat 2026-04-04 (valid Sun–Sat week)
    const r: ActiveRange = { mode: 'weeks', from: '2026-03-29', to: '2026-04-04' };
    const next = stepRangeForward(r, today);
    expect(next.mode).toBe('weeks');
    expect(next.from).toBe('2026-04-05');
    expect(next.to).toBe('2026-04-09'); // clamped to today (2026-04-11 → today)
  });

  it('advances months by one calendar month', () => {
    const r: ActiveRange = { mode: 'months', from: '2026-03-01', to: '2026-03-31' };
    const next = stepRangeForward(r, today);
    expect(next.mode).toBe('months');
    expect(next.from).toBe('2026-04-01');
  });

  it('advances years by one year', () => {
    const r: ActiveRange = { mode: 'years', from: '2024-01-01', to: '2024-12-31' };
    const next = stepRangeForward(r, today);
    expect(next.mode).toBe('years');
    expect(next.from).toBe('2025-01-01');
    expect(next.to).toBe('2025-12-31');
  });

  it('is no-op for all mode', () => {
    const r: ActiveRange = { mode: 'all', from: '2024-01-01', to: today };
    expect(stepRangeForward(r, today)).toEqual(r);
  });
});

// ---------------------------------------------------------------------------
// stepRangeBackward
// ---------------------------------------------------------------------------

describe('stepRangeBackward', () => {
  const earliest = '2024-01-01';

  it('shifts custom range backward by window width', () => {
    const r: ActiveRange = { mode: 'custom', from: '2026-03-01', to: '2026-03-31' }; // 31 days
    const prev = stepRangeBackward(r, earliest);
    expect(prev.from).toBe('2026-01-29');
    expect(prev.to).toBe('2026-02-28');
  });

  it('shifts weeks backward by 7 days', () => {
    // Sun 2026-04-05 – Sat 2026-04-11 (valid Sun–Sat week)
    const r: ActiveRange = { mode: 'weeks', from: '2026-04-05', to: '2026-04-11' };
    const prev = stepRangeBackward(r, earliest);
    expect(prev.from).toBe('2026-03-29');
    expect(prev.to).toBe('2026-04-04');
  });

  it('goes back one calendar month', () => {
    const r: ActiveRange = { mode: 'months', from: '2026-04-01', to: '2026-04-30' };
    const prev = stepRangeBackward(r, earliest);
    expect(prev.from).toBe('2026-03-01');
    expect(prev.to).toBe('2026-03-31');
  });

  it('goes back one year', () => {
    const r: ActiveRange = { mode: 'years', from: '2025-01-01', to: '2025-12-31' };
    const prev = stepRangeBackward(r, earliest);
    expect(prev.from).toBe('2024-01-01');
    expect(prev.to).toBe('2024-12-31');
  });

  it('is no-op for all mode', () => {
    const r: ActiveRange = { mode: 'all', from: '2024-01-01', to: '2026-04-09' };
    expect(stepRangeBackward(r, earliest)).toEqual(r);
  });

  it('clamps from to earliestDate', () => {
    const r: ActiveRange = { mode: 'custom', from: '2024-01-20', to: '2024-01-31' }; // 12 days
    const prev = stepRangeBackward(r, '2024-01-01');
    expect(prev.from >= '2024-01-01').toBe(true);
  });
});
