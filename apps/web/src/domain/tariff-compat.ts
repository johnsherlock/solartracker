/**
 * Compatibility helpers for migrating simple-window tariff data to the
 * schedule-based model.
 *
 * The simple-window model stored up to three named time windows per tariff
 * version (night, peak, and an implicit day window for everything else). The
 * schedule-based model lets users define any number of price periods and
 * assign them freely to a 7-day × 48-half-hour grid.
 *
 * These helpers synthesise a { periods, schedule } pair from existing
 * simple-window fields so that the billing engine can treat old data uniformly.
 * They are also the reference for how common real-world tariff shapes map to
 * the new model:
 *
 *   - Flat rate     → 1 period, all 336 slots point to it
 *   - Day / Night   → 2 periods, night-window slots point to Night period
 *   - Day/Night/Peak→ 3 periods, peak-window slots take priority over night
 *   - EV window     → add an extra low-rate period for specific overnight slots
 *   - Free hours    → add a period with isFreeImport:true for the offer slots
 *
 * There is no fixed limit on the number of periods per version.
 */

import { inWindow, type TariffPricePeriod, type TariffVersion, type WeeklySchedule } from './billing';

// Stable synthetic period IDs used in the returned periods/schedule.
// These are intentionally NOT UUIDs — this function is for in-memory billing
// computation only and must never be used to write rows to tariff_price_periods.
// If you need to persist a synthesised schedule, generate real UUIDs at that point.
const COMPAT_DAY_ID   = 'compat:day';
const COMPAT_NIGHT_ID = 'compat:night';
const COMPAT_PEAK_ID  = 'compat:peak';

/**
 * Synthesise TariffPricePeriod records and a WeeklySchedule from the simple
 * night/peak window fields on a TariffVersion.
 *
 * The resulting schedule applies uniformly across all 7 days — the simple
 * window model had no weekday/weekend distinction.
 *
 * @param tariff  A TariffVersion with optional night/peak window fields.
 * @returns       { periods, schedule } ready for use in the schedule-based
 *                billing functions.
 */
export function migrateWindowsToSchedule(tariff: TariffVersion): {
  periods: TariffPricePeriod[];
  schedule: WeeklySchedule;
} {
  const dayId   = COMPAT_DAY_ID;
  const nightId = COMPAT_NIGHT_ID;
  const peakId  = COMPAT_PEAK_ID;

  const base: Omit<TariffPricePeriod, 'id' | 'periodLabel' | 'ratePerKwh' | 'isFreeImport' | 'sortOrder'> = {
    tariffPlanVersionId: tariff.id,
  };

  const dayPeriod: TariffPricePeriod = {
    ...base,
    id: dayId,
    periodLabel: 'Day',
    ratePerKwh: tariff.dayRate,
    isFreeImport: false,
    sortOrder: 0,
  };

  const periods: TariffPricePeriod[] = [dayPeriod];

  const nightPeriod: TariffPricePeriod | null =
    tariff.nightRate != null && tariff.nightStartLocalTime && tariff.nightEndLocalTime
      ? {
          ...base,
          id: nightId,
          periodLabel: 'Night',
          ratePerKwh: tariff.nightRate,
          isFreeImport: false,
          sortOrder: 1,
        }
      : null;

  if (nightPeriod) periods.push(nightPeriod);

  const peakPeriod: TariffPricePeriod | null =
    tariff.peakRate != null && tariff.peakStartLocalTime && tariff.peakEndLocalTime
      ? {
          ...base,
          id: peakId,
          periodLabel: 'Peak',
          ratePerKwh: tariff.peakRate,
          isFreeImport: false,
          sortOrder: 2,
        }
      : null;

  if (peakPeriod) periods.push(peakPeriod);

  // Build a 336-slot schedule.
  // Slot index = dayIndex * 48 + slotIndex (dayIndex 0=Mon…6=Sun)
  // Priority: peak > night > day (matches the original getTariffRateForInterval logic)
  const schedule: WeeklySchedule = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (let slotIndex = 0; slotIndex < 48; slotIndex++) {
      const totalMinutes = slotIndex * 30;
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mm = String(totalMinutes % 60).padStart(2, '0');
      const slotTime = `${hh}:${mm}`;

      if (peakPeriod && inWindow(slotTime, tariff.peakStartLocalTime, tariff.peakEndLocalTime)) {
        schedule.push(peakId);
      } else if (nightPeriod && inWindow(slotTime, tariff.nightStartLocalTime, tariff.nightEndLocalTime)) {
        schedule.push(nightId);
      } else {
        schedule.push(dayId);
      }
    }
  }

  return { periods, schedule };
}
