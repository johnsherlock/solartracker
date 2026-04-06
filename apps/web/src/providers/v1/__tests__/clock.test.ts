import { describe, expect, it } from 'vitest';
import { toInstallationClock } from '../clock';

describe('toInstallationClock', () => {
  it('keeps winter timestamps unchanged for Europe/Dublin', () => {
    expect(
      toInstallationClock(
        { yr: 2026, mon: 1, dom: 15, dow: 'Thurs', hr: 14, min: 30 },
        'Europe/Dublin',
      ),
    ).toEqual({ hour: 14, minute: 30 });
  });

  it('applies the DST offset after the March 29, 2026 change in Europe/Dublin', () => {
    expect(
      toInstallationClock(
        { yr: 2026, mon: 3, dom: 29, dow: 'Sun', hr: 15, min: 6 },
        'Europe/Dublin',
      ),
    ).toEqual({ hour: 16, minute: 6 });
  });
});
