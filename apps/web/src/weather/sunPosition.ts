import SunCalc from 'suncalc';
import type { SunPosition } from './types';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Compute the current sun position from lat/lon and a UTC timestamp.
 * Never cached — always called fresh per request.
 *
 * suncalc azimuth is measured from south, clockwise in radians.
 * We convert to clockwise-from-north degrees: (azimuthRad * RAD_TO_DEG + 180) % 360
 *
 * daylightRemainingSeconds is derived from the provided sunsetUtc string.
 * If the sun is below the horizon or sunset has passed, it returns 0.
 */
export function computeSunPosition(
  latitude: number,
  longitude: number,
  now: Date,
  sunsetUtc: string | null,
): SunPosition {
  try {
    const pos = SunCalc.getPosition(now, latitude, longitude);
    const elevationDegrees = pos.altitude * RAD_TO_DEG;
    // suncalc azimuth: 0 = south, clockwise. Convert to clockwise from north.
    const azimuthDegrees = ((pos.azimuth * RAD_TO_DEG) + 180) % 360;
    const isAboveHorizon = elevationDegrees > 0;

    let daylightRemainingSeconds = 0;
    if (sunsetUtc && isAboveHorizon) {
      const sunsetMs = new Date(sunsetUtc).getTime();
      daylightRemainingSeconds = Math.max(0, Math.floor((sunsetMs - now.getTime()) / 1000));
    }

    return {
      computedAtUtc: now.toISOString(),
      elevationDegrees: Math.round(elevationDegrees * 10) / 10,
      azimuthDegrees: Math.round(azimuthDegrees * 10) / 10,
      isAboveHorizon,
      daylightRemainingSeconds,
    };
  } catch {
    // Computation failure: return safe defaults (Decision 0004)
    return {
      computedAtUtc: now.toISOString(),
      elevationDegrees: 0,
      azimuthDegrees: 180,
      isAboveHorizon: false,
      daylightRemainingSeconds: 0,
    };
  }
}

/**
 * Format daylightRemainingSeconds as "4h 23m" or "Sunset passed".
 */
export function formatDaylightRemaining(seconds: number): string {
  if (seconds <= 0) return 'Sunset passed';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
