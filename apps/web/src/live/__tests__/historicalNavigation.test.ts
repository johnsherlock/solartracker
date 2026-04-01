import { describe, expect, it } from 'vitest';
import {
  resolveHistoricalSwipeTarget,
  resolveLiveSwipeTarget,
  resolveNavigationTarget,
  resolveNextDayTarget,
  resolvePrevDayTarget,
  shouldIgnoreSwipeTarget,
} from '../swipeNavigation';

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
});

describe('resolveNextDayTarget', () => {
  it('navigates to /live when next day is today', () => {
    expect(resolveNextDayTarget('2026-03-30', '2026-03-31')).toBe('/live');
  });

  it('navigates to /history/<nextDay> when next day is still in the past', () => {
    expect(resolveNextDayTarget('2026-03-29', '2026-03-31')).toBe('/history/2026-03-30');
  });

  it('navigates to /live when next day is in the future', () => {
    expect(resolveNextDayTarget('2026-03-31', '2026-03-31')).toBe('/live');
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
  it('returns yesterday path for rightward swipe >= 50px', () => {
    expect(resolveLiveSwipeTarget(50, 10, '2026-03-31')).toBe('/history/2026-03-30');
    expect(resolveLiveSwipeTarget(120, 20, '2026-03-31')).toBe('/history/2026-03-30');
  });

  it('returns null for rightward swipe below threshold or leftward swipe', () => {
    expect(resolveLiveSwipeTarget(49, 0, '2026-03-31')).toBeNull();
    expect(resolveLiveSwipeTarget(-100, 0, '2026-03-31')).toBeNull();
  });

  it('returns null when vertical movement dominates', () => {
    expect(resolveLiveSwipeTarget(100, 120, '2026-03-31')).toBeNull();
  });
});

describe('resolveHistoricalSwipeTarget', () => {
  const today = '2026-03-31';
  const selectedDate = '2026-03-29';

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

  it('swipe left when next day is today routes to /live', () => {
    expect(resolveHistoricalSwipeTarget(-100, -10, '2026-03-30', today)).toBe('/live');
  });

  it('returns null when below threshold or vertical movement dominates', () => {
    expect(resolveHistoricalSwipeTarget(49, 0, selectedDate, today)).toBeNull();
    expect(resolveHistoricalSwipeTarget(100, 150, selectedDate, today)).toBeNull();
  });
});

describe('shouldIgnoreSwipeTarget', () => {
  it('ignores interactive controls and chart surfaces', () => {
    const buttonLike = {
      closest: (selector: string) => (selector.includes('button') ? {} : null),
    } as unknown as Element;
    const chartLike = {
      closest: (selector: string) =>
        selector.includes('.recharts-responsive-container') ? {} : null,
    } as unknown as Element;

    expect(shouldIgnoreSwipeTarget(buttonLike)).toBe(true);
    expect(shouldIgnoreSwipeTarget(chartLike)).toBe(true);
  });

  it('keeps plain content swipe-eligible', () => {
    const plainTarget = {
      closest: () => null,
    } as unknown as Element;

    expect(shouldIgnoreSwipeTarget(plainTarget)).toBe(false);
  });
});
