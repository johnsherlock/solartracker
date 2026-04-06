import { addDays } from './chartUtils';

const INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="dialog"]',
  '[data-swipe-ignore="true"]',
  '.recharts-responsive-container',
].join(', ');

export function resolveNavigationTarget(date: string, today: string): string {
  if (date >= today) return '/live';
  return `/history/${date}`;
}

export function resolveNextDayTarget(selectedDate: string, today: string): string {
  return resolveNavigationTarget(addDays(selectedDate, 1), today);
}

export function resolvePrevDayTarget(selectedDate: string): string {
  return `/history/${addDays(selectedDate, -1)}`;
}

export function resolveLiveSwipeTarget(deltaX: number, deltaY: number, today: string): string | null {
  if (deltaX < 50) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return null;
  return resolvePrevDayTarget(today);
}

export function resolveHistoricalSwipeTarget(
  deltaX: number,
  deltaY: number,
  selectedDate: string,
  today: string,
): string | null {
  if (Math.abs(deltaX) < 50) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return null;
  return deltaX > 0
    ? resolvePrevDayTarget(selectedDate)
    : resolveNextDayTarget(selectedDate, today);
}

export function shouldIgnoreSwipeTarget(target: Element | null): boolean {
  if (!target) return false;
  return target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}
