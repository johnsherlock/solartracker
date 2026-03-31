import { describe, it, expect } from 'vitest';
import { addDays } from '../chartUtils';

// ---------------------------------------------------------------------------
// Pure navigation logic helpers (extracted for testing)
// ---------------------------------------------------------------------------

/**
 * Given a date and today, decide where the app should route to.
 * - date === today   => '/live'
 * - date > today     => '/live'  (no future navigation)
 * - date < today     => '/history/<date>'
 */
function resolveNavigationTarget(date: string, today: string): string {
  if (date >= today) return '/live';
  return `/history/${date}`;
}

/**
 * Given the selected date on the historical day screen, decide
 * where the "next day" button navigates to.
 * - If next day >= today, go to live
 * - Otherwise go to /history/<nextDay>
 */
function resolveNextDayTarget(selectedDate: string, today: string): string {
  const nextDay = addDays(selectedDate, 1);
  return resolveNavigationTarget(nextDay, today);
}

/**
 * Given the selected date on the historical day screen, decide
 * where the "previous day" button navigates to.
 */
function resolvePrevDayTarget(selectedDate: string): string {
  const prevDay = addDays(selectedDate, -1);
  return `/history/${prevDay}`;
}

/**
 * On the live screen, swipe right = go to yesterday.
 * Swipe left = disabled (can't go to future). Returns null for left swipe.
 */
function resolveLiveSwipeTarget(deltaX: number, today: string): string | null {
  if (deltaX < 50) return null; // below threshold or leftward swipe
  const yesterday = addDays(today, -1);
  return `/history/${yesterday}`;
}

/**
 * On the historical day screen:
 * - Swipe right (positive deltaX) => previous day
 * - Swipe left (negative deltaX) => next day
 * Returns null if below threshold or movement is not primarily horizontal.
 */
function resolveHistoricalSwipeTarget(
  deltaX: number,
  deltaY: number,
  selectedDate: string,
  today: string,
): string | null {
  // Threshold check
  if (Math.abs(deltaX) < 50) return null;
  // Horizontal must dominate
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return null;

  if (deltaX > 0) {
    // Swipe right = previous day
    return resolvePrevDayTarget(selectedDate);
  } else {
    // Swipe left = next day
    return resolveNextDayTarget(selectedDate, today);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveNavigationTarget', () => {
  it('routes today to /live', () => {
    expect(resolveNavigationTarget('2026-03-31', '2026-03-31')).toBe('/live');
  });

  it('routes a future date to /live', () => {
    expect(resolveNavigationTarget('2026-04-01', '2026-03-31')).toBe('/live');
  });

  it('routes a past date to /history/<date>', () => {
    expect(resolveNavigationTarget('2026-03-30', '2026-03-31')).toBe('/history/2026-03-30');
  });

  it('routes yesterday to /history/<date>', () => {
    const today = '2026-03-31';
    const yesterday = addDays(today, -1);
    expect(resolveNavigationTarget(yesterday, today)).toBe(`/history/${yesterday}`);
  });
});

describe('resolveNextDayTarget', () => {
  it('navigates to /live when next day is today', () => {
    const today = '2026-03-31';
    const yesterday = addDays(today, -1); // 2026-03-30
    expect(resolveNextDayTarget(yesterday, today)).toBe('/live');
  });

  it('navigates to /history/<nextDay> when next day is still in the past', () => {
    const today = '2026-03-31';
    const twoDaysAgo = addDays(today, -2); // 2026-03-29
    expect(resolveNextDayTarget(twoDaysAgo, today)).toBe(`/history/${addDays(today, -1)}`);
  });

  it('navigates to /live when next day is in the future', () => {
    const today = '2026-03-31';
    // selectedDate is today → next day is tomorrow
    expect(resolveNextDayTarget(today, today)).toBe('/live');
  });
});

describe('resolvePrevDayTarget', () => {
  it('returns the previous day path', () => {
    expect(resolvePrevDayTarget('2026-03-30')).toBe('/history/2026-03-29');
  });

  it('crosses month boundary correctly', () => {
    expect(resolvePrevDayTarget('2026-04-01')).toBe('/history/2026-03-31');
  });
});

describe('resolveLiveSwipeTarget', () => {
  const today = '2026-03-31';
  const yesterday = addDays(today, -1);

  it('returns yesterday path for rightward swipe >= 50px', () => {
    expect(resolveLiveSwipeTarget(50, today)).toBe(`/history/${yesterday}`);
    expect(resolveLiveSwipeTarget(120, today)).toBe(`/history/${yesterday}`);
  });

  it('returns null for rightward swipe below threshold', () => {
    expect(resolveLiveSwipeTarget(49, today)).toBeNull();
    expect(resolveLiveSwipeTarget(0, today)).toBeNull();
  });

  it('returns null for leftward swipe (negative deltaX)', () => {
    expect(resolveLiveSwipeTarget(-100, today)).toBeNull();
  });
});

describe('resolveHistoricalSwipeTarget', () => {
  const today = '2026-03-31';
  const selectedDate = '2026-03-29'; // 2 days ago

  it('swipe right returns previous day', () => {
    expect(resolveHistoricalSwipeTarget(100, 10, selectedDate, today)).toBe(
      '/history/2026-03-28',
    );
  });

  it('swipe left returns next day path', () => {
    expect(resolveHistoricalSwipeTarget(-100, -10, selectedDate, today)).toBe(
      '/history/2026-03-30',
    );
  });

  it('swipe left when next day is yesterday routes to /live', () => {
    const yesterday = addDays(today, -1); // 2026-03-30
    expect(resolveHistoricalSwipeTarget(-100, -10, yesterday, today)).toBe('/live');
  });

  it('returns null when below 50px threshold', () => {
    expect(resolveHistoricalSwipeTarget(49, 0, selectedDate, today)).toBeNull();
    expect(resolveHistoricalSwipeTarget(-49, 0, selectedDate, today)).toBeNull();
  });

  it('returns null when vertical movement dominates', () => {
    expect(resolveHistoricalSwipeTarget(100, 150, selectedDate, today)).toBeNull();
    expect(resolveHistoricalSwipeTarget(-100, -200, selectedDate, today)).toBeNull();
  });

  it('returns null when deltaX equals deltaY (not strictly horizontal)', () => {
    expect(resolveHistoricalSwipeTarget(100, 100, selectedDate, today)).toBeNull();
  });
});

describe('DayTrendChart mode prop determines eyebrow text', () => {
  it("mode='historical' should produce 'Day' eyebrow (not 'Today')", () => {
    // The eyebrow logic from DayAnalysis.tsx:
    // const eyebrow = mode === 'historical' ? 'Day' : 'Today';
    const getEyebrow = (mode: 'live' | 'historical') =>
      mode === 'historical' ? 'Day' : 'Today';
    expect(getEyebrow('historical')).toBe('Day');
    expect(getEyebrow('live')).toBe('Today');
  });

  it("mode='historical' should produce 'Energy trend' title (not 'Live trend')", () => {
    const getTitle = (mode: 'live' | 'historical') =>
      mode === 'historical' ? 'Energy trend' : 'Live trend';
    expect(getTitle('historical')).toBe('Energy trend');
    expect(getTitle('live')).toBe('Live trend');
  });
});

describe('DayTotalsPanel mode prop determines eyebrow text', () => {
  it("mode='historical' uses 'Day totals' not 'Today so far'", () => {
    const getEyebrow = (mode: 'live' | 'historical') =>
      mode === 'historical' ? 'Day totals' : 'Today so far';
    expect(getEyebrow('historical')).toBe('Day totals');
    expect(getEyebrow('live')).toBe('Today so far');
  });
});

describe('DayValuePanel mode prop determines eyebrow text', () => {
  it("mode='historical' uses 'Day value' not 'Today value'", () => {
    const getEyebrow = (mode: 'live' | 'historical') =>
      mode === 'historical' ? 'Day value' : 'Today value';
    expect(getEyebrow('historical')).toBe('Day value');
    expect(getEyebrow('live')).toBe('Today value');
  });
});
