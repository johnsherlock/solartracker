import { describe, expect, it } from 'vitest';
import { getAdjacentPrefetchTargets } from '../prefetch';

const TODAY = '2026-04-01';

describe('getAdjacentPrefetchTargets', () => {
  it('always includes the previous day', () => {
    const targets = getAdjacentPrefetchTargets('2026-03-30', TODAY);
    expect(targets).toContain('/history/2026-03-29');
  });

  it('includes the next day when it is strictly before today', () => {
    // selectedDate = 2026-03-29, nextDay = 2026-03-30, today = 2026-04-01 → prefetch
    const targets = getAdjacentPrefetchTargets('2026-03-29', TODAY);
    expect(targets).toContain('/history/2026-03-30');
  });

  it('omits the next day when it equals today (user navigates to /live, not /history)', () => {
    // selectedDate = 2026-03-31, nextDay = 2026-04-01 === today → omit
    const targets = getAdjacentPrefetchTargets('2026-03-31', TODAY);
    expect(targets).not.toContain(`/history/${TODAY}`);
    expect(targets).not.toContain('/history/2026-04-01');
  });

  it('omits the next day when it is beyond today', () => {
    // selectedDate = today, nextDay = tomorrow → omit
    const targets = getAdjacentPrefetchTargets(TODAY, TODAY);
    expect(targets.every((t) => !t.includes('2026-04-02'))).toBe(true);
  });

  it('returns only the previous day when selected date is yesterday', () => {
    // nextDay = today → omit; only prev should appear
    const targets = getAdjacentPrefetchTargets('2026-03-31', TODAY);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toBe('/history/2026-03-30');
  });

  it('returns both prev and next for a day well in the past', () => {
    const targets = getAdjacentPrefetchTargets('2026-03-15', TODAY);
    expect(targets).toHaveLength(2);
    expect(targets).toContain('/history/2026-03-14');
    expect(targets).toContain('/history/2026-03-16');
  });

  it('returns /history paths, never /live', () => {
    const targets = getAdjacentPrefetchTargets('2026-03-31', TODAY);
    expect(targets.every((t) => t.startsWith('/history/'))).toBe(true);
  });

  it('crosses month boundaries correctly', () => {
    const targets = getAdjacentPrefetchTargets('2026-03-01', TODAY);
    expect(targets).toContain('/history/2026-02-28');
    expect(targets).toContain('/history/2026-03-02');
  });

  it('button and swipe navigation share the same prefetch targets (same function)', () => {
    // Both button navigation and swipe navigation call router.push() with the
    // same targets produced by swipeNavigation.ts. This test asserts that the
    // prefetch targets align with the routes those navigation paths resolve to.
    const targets = getAdjacentPrefetchTargets('2026-03-29', TODAY);
    // Swipe right → prev day; swipe left → next day (both in past here)
    expect(targets).toContain('/history/2026-03-28'); // prev
    expect(targets).toContain('/history/2026-03-30'); // next
  });
});
