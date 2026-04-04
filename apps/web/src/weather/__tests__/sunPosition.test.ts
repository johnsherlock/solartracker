import { describe, it, expect } from 'vitest';
import { computeSunPosition, formatDaylightRemaining } from '../sunPosition';

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
