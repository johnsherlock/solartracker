import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _reset, get, prefetch } from '../dayCache';
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

beforeEach(() => {
  _reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('prefetch', () => {
  it('stores a promise for a past date', async () => {
    const date = '2026-03-30';
    const payload = makePayload(date);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );

    prefetch(date, TODAY);

    const cached = get(date);
    expect(cached).toBeInstanceOf(Promise);
    await expect(cached).resolves.toEqual(payload);
  });

  it('does not issue a second fetch when called twice for the same date', async () => {
    const date = '2026-03-30';
    const payload = makePayload(date);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal('fetch', fetchMock);

    prefetch(date, TODAY);
    prefetch(date, TODAY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when date equals today', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    prefetch(TODAY, TODAY);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(get(TODAY)).toBeNull();
  });

  it('is a no-op when date is in the future', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    prefetch('2026-04-02', TODAY);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(get('2026-04-02')).toBeNull();
  });

  it('fetches the correct API path', () => {
    const date = '2026-03-15';
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => makePayload(date) });
    vi.stubGlobal('fetch', fetchMock);

    prefetch(date, TODAY);

    expect(fetchMock).toHaveBeenCalledWith('/api/history/2026-03-15');
  });

  it('rejects the cached promise when the response is not ok', async () => {
    const date = '2026-03-10';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );

    prefetch(date, TODAY);

    const cached = get(date);
    await expect(cached).rejects.toThrow('Failed to fetch history for 2026-03-10: 404');
  });
});

describe('get', () => {
  it('returns null before prefetch is called', () => {
    expect(get('2026-03-30')).toBeNull();
  });

  it('returns the cached promise after prefetch', async () => {
    const date = '2026-03-30';
    const payload = makePayload(date);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
    );

    prefetch(date, TODAY);
    const result = get(date);

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual(payload);
  });
});
