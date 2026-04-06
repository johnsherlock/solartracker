import { addDays } from './chartUtils';

/**
 * Returns the set of /history/<date> routes that should be prefetched when the
 * user is viewing a historical day. Prefetching these routes means Next.js will
 * cache the RSC payload, so navigation via router.push() serves the result
 * instantly without a server round-trip.
 *
 * Rules:
 * - Always prefetch the previous day (browsing backwards is the common path).
 * - Prefetch the next day only when it is strictly before today — if nextDay
 *   equals today the user navigates to /live, not a historical route, so there
 *   is nothing to prefetch here.
 * - Never prefetch today or any future date.
 */
export function getAdjacentPrefetchTargets(selectedDate: string, today: string): string[] {
  const targets: string[] = [];

  targets.push(`/history/${addDays(selectedDate, -1)}`);

  const nextDay = addDays(selectedDate, 1);
  if (nextDay < today) {
    targets.push(`/history/${nextDay}`);
  }

  return targets;
}
