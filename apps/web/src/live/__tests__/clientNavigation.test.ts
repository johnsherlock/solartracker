import { describe, expect, it } from 'vitest';
import { extractHistoricalDate, resolveClientNavigation } from '../clientNavigation';
import type { HistoricalDayPayload } from '../../../app/api/history/[date]/route';

const TODAY = '2026-04-01';

function makePayload(date: string): HistoricalDayPayload {
  return {
    today: TODAY,
    displayDate: 'Mon 30 Mar 2026',
    selectedDate: date,
    installationContext: null,
    timezone: 'Europe/Dublin',
    screenState: 'healthy',
    health: {
      minutesStale: null,
      lastReadingLocalTime: '23:59',
      refreshedAtLocalTime: '00:00:00',
      uptimePercent: 100,
      expectedMinutes: 1440,
      coveredMinutes: 1440,
      incidents: [],
      primaryIncident: null,
    },
    hasTariff: false,
    minuteChartData: [],
    halfHourChartData: [],
    hourChartData: [],
    costChartData: [],
    dayTotals: null,
    financialEstimate: null,
  };
}

// ---------------------------------------------------------------------------
// extractHistoricalDate
// ---------------------------------------------------------------------------

describe('extractHistoricalDate', () => {
  it('extracts a date from a valid /history/YYYY-MM-DD path', () => {
    expect(extractHistoricalDate('/history/2026-03-30')).toBe('2026-03-30');
  });

  it('returns null for /live', () => {
    expect(extractHistoricalDate('/live')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractHistoricalDate('')).toBeNull();
  });

  it('returns null for a path with a trailing slash', () => {
    expect(extractHistoricalDate('/history/2026-03-30/')).toBeNull();
  });

  it('returns null for a partial date', () => {
    expect(extractHistoricalDate('/history/2026-03')).toBeNull();
  });

  it('returns null for /history/ with no date', () => {
    expect(extractHistoricalDate('/history/')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveClientNavigation
// ---------------------------------------------------------------------------

describe('resolveClientNavigation', () => {
  it('returns cache-hit with payload when the cache has a resolved entry', async () => {
    const date = '2026-03-30';
    const payload = makePayload(date);
    const getCache = (_: string) => Promise.resolve(payload);

    const result = await resolveClientNavigation(date, TODAY, getCache);

    expect(result).toEqual({ type: 'cache-hit', payload });
  });

  it('returns cache-miss when date equals today', async () => {
    const getCache = (_: string) => Promise.resolve(makePayload(TODAY));

    const result = await resolveClientNavigation(TODAY, TODAY, getCache);

    expect(result).toEqual({ type: 'cache-miss' });
  });

  it('returns cache-miss when date is in the future', async () => {
    const getCache = (_: string) => Promise.resolve(makePayload('2026-04-02'));

    const result = await resolveClientNavigation('2026-04-02', TODAY, getCache);

    expect(result).toEqual({ type: 'cache-miss' });
  });

  it('returns cache-miss when the cache has no entry for the date', async () => {
    const getCache = (_: string) => null;

    const result = await resolveClientNavigation('2026-03-30', TODAY, getCache);

    expect(result).toEqual({ type: 'cache-miss' });
  });

  it('returns cache-miss when the cached promise rejects', async () => {
    const getCache = (_: string) => Promise.reject<HistoricalDayPayload>(new Error('fetch failed'));

    const result = await resolveClientNavigation('2026-03-30', TODAY, getCache);

    expect(result).toEqual({ type: 'cache-miss' });
  });
});
