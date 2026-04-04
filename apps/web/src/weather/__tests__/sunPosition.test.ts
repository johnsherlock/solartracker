import { describe, it, expect } from 'vitest';
import { computeSunPosition, formatDaylightRemaining, formatDaylightStatus } from '../sunPosition';

// Cork, Ireland coords used throughout
const LAT = 51.8985;
const LON = -8.4756;

// ---------------------------------------------------------------------------
// computeSunPosition
// ---------------------------------------------------------------------------

describe('computeSunPosition', () => {
  it('returns isAboveHorizon=true at solar noon in summer', () => {
    // June 21 at 13:00 UTC — well above horizon for Cork
    const now = new Date('2024-06-21T13:00:00Z');
    const sunsetUtc = '2024-06-21T21:30:00Z';
    const result = computeSunPosition(LAT, LON, now, sunsetUtc);

    expect(result.isAboveHorizon).toBe(true);
    expect(result.elevationDegrees).toBeGreaterThan(40);
    expect(result.daylightRemainingSeconds).toBeGreaterThan(0);
    expect(result.computedAtUtc).toBe(now.toISOString());
  });

  it('returns isAboveHorizon=false at midnight', () => {
    const now = new Date('2024-06-21T02:00:00Z');
    const result = computeSunPosition(LAT, LON, now, null);

    expect(result.isAboveHorizon).toBe(false);
    expect(result.daylightRemainingSeconds).toBe(0);
  });

  it('returns daylightRemainingSeconds=0 when sunsetUtc is null', () => {
    const now = new Date('2024-06-21T13:00:00Z');
    const result = computeSunPosition(LAT, LON, now, null);

    expect(result.daylightRemainingSeconds).toBe(0);
  });

  it('returns daylightRemainingSeconds=0 when sun is above horizon but sunset has passed', () => {
    const now = new Date('2024-06-21T13:00:00Z');
    // Sunset in the past
    const sunsetUtc = '2024-06-21T10:00:00Z';
    const result = computeSunPosition(LAT, LON, now, sunsetUtc);

    expect(result.daylightRemainingSeconds).toBe(0);
  });

  it('returns a north-clockwise azimuth in [0, 360)', () => {
    const now = new Date('2024-06-21T13:00:00Z');
    const result = computeSunPosition(LAT, LON, now, null);

    expect(result.azimuthDegrees).toBeGreaterThanOrEqual(0);
    expect(result.azimuthDegrees).toBeLessThan(360);
  });

  it('does not throw when given unusual inputs', () => {
    // suncalc may return NaN for out-of-range inputs rather than throwing,
    // so we just verify the function itself does not throw
    const now = new Date('2024-06-21T13:00:00Z');
    expect(() => computeSunPosition(91, 200, now, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatDaylightRemaining
// ---------------------------------------------------------------------------

describe('formatDaylightRemaining', () => {
  it('returns "Sunset passed" for 0 seconds', () => {
    expect(formatDaylightRemaining(0)).toBe('Sunset passed');
  });

  it('returns "Sunset passed" for negative seconds', () => {
    expect(formatDaylightRemaining(-100)).toBe('Sunset passed');
  });

  it('formats minutes only when under an hour', () => {
    expect(formatDaylightRemaining(45 * 60)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatDaylightRemaining(4 * 3600 + 23 * 60)).toBe('4h 23m');
  });

  it('formats exact hours with 0 minutes', () => {
    expect(formatDaylightRemaining(2 * 3600)).toBe('2h 0m');
  });
});

// ---------------------------------------------------------------------------
// formatDaylightStatus
// ---------------------------------------------------------------------------

// Shared sun events fixture
const SUN_EVENTS = {
  sunriseUtc: '2024-06-21T05:00:00Z',
  sunsetUtc:  '2024-06-21T21:30:00Z',
};

function makeSunPosition(overrides: Partial<{
  isAboveHorizon: boolean;
  daylightRemainingSeconds: number;
  computedAtUtc: string;
}>): Parameters<typeof formatDaylightStatus>[0] {
  return {
    computedAtUtc: '2024-06-21T13:00:00Z',
    elevationDegrees: 40,
    azimuthDegrees: 180,
    isAboveHorizon: true,
    daylightRemainingSeconds: 4 * 3600 + 23 * 60,
    ...overrides,
  };
}

describe('formatDaylightStatus', () => {
  it('returns "Daylight left" with remaining time when sun is above horizon', () => {
    const result = formatDaylightStatus(makeSunPosition({}), SUN_EVENTS);
    expect(result.label).toBe('Daylight left');
    expect(result.value).toBe('4h 23m');
  });

  it('returns "Until sunrise" label in the pre-dawn window', () => {
    // 01:00 UTC, well before sunrise at 05:00
    const pos = makeSunPosition({ isAboveHorizon: false, daylightRemainingSeconds: 0, computedAtUtc: '2024-06-21T01:00:00Z' });
    const result = formatDaylightStatus(pos, SUN_EVENTS);
    expect(result.label).toBe('Until sunrise');
  });

  it('counts down correctly to sunrise', () => {
    // 03:00 UTC → 2 hours until sunrise at 05:00
    const pos = makeSunPosition({ isAboveHorizon: false, daylightRemainingSeconds: 0, computedAtUtc: '2024-06-21T03:00:00Z' });
    const result = formatDaylightStatus(pos, SUN_EVENTS);
    expect(result.value).toBe('2h 0m');
  });

  it('returns "Sunset passed" after sunset (post-dusk, after sunriseUtc of same day)', () => {
    // 22:00 UTC — after sunset at 21:30, still same calendar day so past sunriseUtc
    const pos = makeSunPosition({ isAboveHorizon: false, daylightRemainingSeconds: 0, computedAtUtc: '2024-06-21T22:00:00Z' });
    const result = formatDaylightStatus(pos, SUN_EVENTS);
    expect(result.label).toBe('Daylight left');
    expect(result.value).toBe('Sunset passed');
  });

  it('returns "Sunset passed" when sunEvents is null and sun is below horizon', () => {
    const pos = makeSunPosition({ isAboveHorizon: false, daylightRemainingSeconds: 0 });
    const result = formatDaylightStatus(pos, null);
    expect(result.value).toBe('Sunset passed');
  });

  it('formats sub-hour pre-dawn countdown in minutes only', () => {
    // 04:45 UTC → 15 minutes until sunrise at 05:00
    const pos = makeSunPosition({ isAboveHorizon: false, daylightRemainingSeconds: 0, computedAtUtc: '2024-06-21T04:45:00Z' });
    const result = formatDaylightStatus(pos, SUN_EVENTS);
    expect(result.value).toBe('15m');
  });
});
