import { describe, expect, it, vi } from 'vitest';
import { fetchMinuteData } from '../adapter';

describe('fetchMinuteData', () => {
  it('keeps provider-local clock fields and filters out rows from other dates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { yr: 2026, mon: 3, dom: 29, dow: 'Mon', hr: 0, min: 59, imp: 3600 },
        { yr: 2026, mon: 3, dom: 30, dow: 'Mon', hr: 1, min: 0, imp: 3600 },
        { yr: 2026, mon: 3, dom: 30, dow: 'Mon', hr: 1, min: 1, imp: 7200 },
      ],
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMinuteData('2026-03-30', 'Europe/Dublin');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://jmcjm1731b.execute-api.eu-west-1.amazonaws.com/prod/minute-data?date=2026-03-30',
      { cache: 'no-store' },
    );
    expect(result).toEqual([
      expect.objectContaining({ hour: 1, minute: 0, importKwh: 0.001 }),
      expect.objectContaining({ hour: 1, minute: 1, importKwh: 0.002 }),
    ]);

    vi.unstubAllGlobals();
  });
});
