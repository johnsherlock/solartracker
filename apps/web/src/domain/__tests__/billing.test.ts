import { describe, expect, it } from 'vitest';
import {
  calculateBillingPeriod,
  calculateBillingFromDailySummariesScheduled,
  calculateIntervalImportCostScheduled,
  calculateWithoutSolarImportKwh,
  getISODayIndex,
  getPricePeriodForSlot,
  getScheduledRateForInterval,
  getSlotIndex,
  getTariffRateForInterval,
  resolveSlotIndex,
  resolveTariffVersion,
  type BandBreakdown,
  type DailySummaryForBillingScheduled,
  type FixedChargeVersion,
  type IntervalReading,
  type ScheduledTariffVersion,
  type TariffPricePeriod,
  type TariffVersion,
  type WeeklySchedule,
} from '../billing';

const tariffVersions: TariffVersion[] = [
  {
    id: 'spring',
    validFromLocalDate: '2025-05-01',
    validToLocalDate: '2025-05-31',
    dayRate: 0.3451,
    nightRate: 0.1848,
    peakRate: 0.3617,
    exportRate: 0.2,
    vatRate: 0.09,
    discountRuleType: 'percentage',
    discountValue: 0.1,
    nightStartLocalTime: '23:00',
    nightEndLocalTime: '08:00',
    peakStartLocalTime: '17:00',
    peakEndLocalTime: '19:00',
  },
  {
    id: 'renewal',
    validFromLocalDate: '2026-01-09',
    validToLocalDate: null,
    dayRate: 0.3865,
    nightRate: 0.2125,
    peakRate: 0.434,
    exportRate: 0.185,
    vatRate: 0.09,
    discountRuleType: 'percentage',
    discountValue: 0.1,
    nightStartLocalTime: '23:00',
    nightEndLocalTime: '08:00',
    peakStartLocalTime: '17:00',
    peakEndLocalTime: '19:00',
  },
];

const fixedChargeVersions: FixedChargeVersion[] = [
  {
    id: 'standing-spring',
    tariffPlanVersionId: 'spring',
    chargeType: 'standing_charge',
    amount: 0.59,
    unit: 'per_day',
    validFromLocalDate: '2025-05-01',
    validToLocalDate: '2025-05-31',
  },
  {
    id: 'standing-renewal',
    tariffPlanVersionId: 'renewal',
    chargeType: 'standing_charge',
    amount: 0.66,
    unit: 'per_day',
    validFromLocalDate: '2026-01-09',
    validToLocalDate: null,
  },
];

describe('resolveTariffVersion', () => {
  it('uses the tariff version active on the interval local date', () => {
    expect(resolveTariffVersion(tariffVersions, '2025-05-07T12:00').id).toBe('spring');
    expect(resolveTariffVersion(tariffVersions, '2026-01-09T12:00').id).toBe('renewal');
  });
});

describe('getTariffRateForInterval', () => {
  it('resolves night, day, and peak windows using local time', () => {
    const spring = tariffVersions[0];

    expect(getTariffRateForInterval(spring, '2025-05-07T07:30')).toBe(0.1848);
    expect(getTariffRateForInterval(spring, '2025-05-07T12:00')).toBe(0.3451);
    expect(getTariffRateForInterval(spring, '2025-05-07T17:30')).toBe(0.3617);
  });
});

describe('calculateWithoutSolarImportKwh', () => {
  it('uses actual household demand rather than billed import as the baseline', () => {
    const reading: IntervalReading = {
      intervalStartLocal: '2025-05-07T12:00',
      importKwh: 0.1,
      exportKwh: 0.3,
      generatedKwh: 1.4,
      consumedKwh: 1.0,
      immersionDivertedKwh: 0.2,
    };

    expect(calculateWithoutSolarImportKwh(reading)).toBe(1);
  });
});

describe('calculateBillingPeriod', () => {
  it('keeps export as a separate credit and rolls it into net cost and savings', () => {
    const readings: IntervalReading[] = [
      {
        intervalStartLocal: '2025-05-07T12:00',
        importKwh: 0.1,
        exportKwh: 0.3,
        generatedKwh: 1.4,
        consumedKwh: 1.0,
        immersionDivertedKwh: 0.2,
      },
      {
        intervalStartLocal: '2025-05-07T18:00',
        importKwh: 0.4,
        exportKwh: 0,
        generatedKwh: 0.2,
        consumedKwh: 0.6,
        immersionDivertedKwh: 0,
      },
    ];

    const result = calculateBillingPeriod(readings, tariffVersions, fixedChargeVersions);

    expect(result.actual.fixedCharges).toBe(0.59);
    expect(result.actual.exportCredit).toBe(0.06);
    expect(result.actual.netCost).toBeLessThan(result.withoutSolar.netCost);
    expect(result.solar.savings).toBe(result.withoutSolar.netCost - result.actual.netCost);
    expect(result.solar.exportValue).toBe(result.actual.exportCredit);
  });

  it('applies the same fixed charges in both actual and without-solar scenarios', () => {
    const readings: IntervalReading[] = [
      {
        intervalStartLocal: '2026-01-09T12:00',
        importKwh: 1,
        exportKwh: 0,
        generatedKwh: 0,
        consumedKwh: 1,
      },
    ];

    const result = calculateBillingPeriod(readings, tariffVersions, fixedChargeVersions);

    expect(result.actual.fixedCharges).toBe(0.66);
    expect(result.withoutSolar.fixedCharges).toBe(0.66);
  });
});

// ---------------------------------------------------------------------------
// Schedule-based billing tests
// ---------------------------------------------------------------------------

// Helpers for building schedule-based test fixtures

/** Build a flat 336-slot schedule pointing all slots to a single period id. */
function flatSchedule(periodId: string): WeeklySchedule {
  return Array(336).fill(periodId);
}

/**
 * Build a schedule for a simple day/night split applied uniformly across all
 * 7 days. nightSlots is an array of half-hour slot indices (0–47) that map to
 * the night period; everything else maps to the day period.
 */
function dayNightSchedule(
  dayPeriodId: string,
  nightPeriodId: string,
  nightSlots: number[],
): WeeklySchedule {
  const nightSet = new Set(nightSlots);
  const schedule: WeeklySchedule = [];
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 48; slot++) {
      schedule.push(nightSet.has(slot) ? nightPeriodId : dayPeriodId);
    }
  }
  return schedule;
}

const stdDay: TariffPricePeriod = {
  id: 'p-day',
  tariffPlanVersionId: 'v1',
  periodLabel: 'Day',
  ratePerKwh: 0.30,
  isFreeImport: false,
  sortOrder: 0,
};

const stdNight: TariffPricePeriod = {
  id: 'p-night',
  tariffPlanVersionId: 'v1',
  periodLabel: 'Night',
  ratePerKwh: 0.15,
  isFreeImport: false,
  sortOrder: 1,
};

const stdFree: TariffPricePeriod = {
  id: 'p-free',
  tariffPlanVersionId: 'v1',
  periodLabel: 'Free hours',
  ratePerKwh: 0,
  isFreeImport: true,
  sortOrder: 2,
};

// Night slots: 46 (23:00) and 47 (23:30) and 0–15 (00:00–07:30)
const nightSlots = [46, 47, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

describe('getISODayIndex', () => {
  it('returns 0 for Monday', () => {
    // 2025-05-05 is a Monday
    expect(getISODayIndex('2025-05-05')).toBe(0);
  });

  it('returns 4 for Friday', () => {
    // 2025-05-09 is a Friday
    expect(getISODayIndex('2025-05-09')).toBe(4);
  });

  it('returns 6 for Sunday', () => {
    // 2025-05-11 is a Sunday
    expect(getISODayIndex('2025-05-11')).toBe(6);
  });
});

describe('getSlotIndex', () => {
  it('returns 0 for 00:00', () => expect(getSlotIndex('00:00')).toBe(0));
  it('returns 1 for 00:30', () => expect(getSlotIndex('00:30')).toBe(1));
  it('returns 2 for 01:00', () => expect(getSlotIndex('01:00')).toBe(2));
  it('returns 46 for 23:00', () => expect(getSlotIndex('23:00')).toBe(46));
  it('returns 47 for 23:30', () => expect(getSlotIndex('23:30')).toBe(47));
});

describe('resolveSlotIndex', () => {
  it('returns the correct slot for Monday midnight (slot 0)', () => {
    // 2025-05-05 is Monday; slot 0 = 00:00 → index 0*48+0 = 0
    expect(resolveSlotIndex('2025-05-05T00:00')).toBe(0);
  });

  it('returns the correct slot for Monday 00:30 (slot 1)', () => {
    expect(resolveSlotIndex('2025-05-05T00:30')).toBe(1);
  });

  it('returns the correct slot for Monday 12:00 (slot 24)', () => {
    expect(resolveSlotIndex('2025-05-05T12:00')).toBe(24);
  });

  it('returns the correct slot for Sunday 23:30 (last slot, 335)', () => {
    // Sunday (dayIndex 6) * 48 + slot 47 = 288 + 47 = 335
    expect(resolveSlotIndex('2025-05-11T23:30')).toBe(335);
  });

  it('returns the correct slot for Friday 17:00 (slot 34)', () => {
    // Friday (dayIndex 4) * 48 + slot 34 (17:00) = 192 + 34 = 226
    expect(resolveSlotIndex('2025-05-09T17:00')).toBe(226);
  });
});

describe('getPricePeriodForSlot', () => {
  it('resolves to the single period for a flat-rate schedule', () => {
    const schedule = flatSchedule('p-day');
    const result = getPricePeriodForSlot([stdDay], schedule, '2025-05-07T14:00');
    expect(result?.id).toBe('p-day');
  });

  it('resolves night period for a slot in the night window', () => {
    // slot 46 = 23:00 → night
    const schedule = dayNightSchedule('p-day', 'p-night', nightSlots);
    const result = getPricePeriodForSlot([stdDay, stdNight], schedule, '2025-05-05T23:00');
    expect(result?.id).toBe('p-night');
  });

  it('resolves day period for a slot outside the night window', () => {
    const schedule = dayNightSchedule('p-day', 'p-night', nightSlots);
    const result = getPricePeriodForSlot([stdDay, stdNight], schedule, '2025-05-05T12:00');
    expect(result?.id).toBe('p-day');
  });

  it('resolves free-import period for a free slot', () => {
    // Build a schedule where slot 24 (12:00) on Monday is free
    const schedule = flatSchedule('p-day');
    // Monday slot 24 = index 24
    schedule[24] = 'p-free';
    const result = getPricePeriodForSlot([stdDay, stdFree], schedule, '2025-05-05T12:00');
    expect(result?.id).toBe('p-free');
    expect(result?.isFreeImport).toBe(true);
  });

  it('returns undefined when the schedule slot has no matching period', () => {
    const schedule = flatSchedule('unknown-id');
    const result = getPricePeriodForSlot([stdDay], schedule, '2025-05-05T12:00');
    expect(result).toBeUndefined();
  });
});

describe('getScheduledRateForInterval', () => {
  it('returns the day rate for a day slot', () => {
    const schedule = dayNightSchedule('p-day', 'p-night', nightSlots);
    expect(getScheduledRateForInterval([stdDay, stdNight], schedule, '2025-05-05T12:00')).toBe(0.30);
  });

  it('returns the night rate for a night slot', () => {
    const schedule = dayNightSchedule('p-day', 'p-night', nightSlots);
    expect(getScheduledRateForInterval([stdDay, stdNight], schedule, '2025-05-05T23:00')).toBe(0.15);
  });

  it('returns 0 for a free-import slot regardless of ratePerKwh', () => {
    const schedule = flatSchedule('p-free');
    expect(getScheduledRateForInterval([stdFree], schedule, '2025-05-05T12:00')).toBe(0);
  });

  it('returns 0 when the period id is not found in the periods list', () => {
    const schedule = flatSchedule('missing');
    expect(getScheduledRateForInterval([stdDay], schedule, '2025-05-05T12:00')).toBe(0);
  });
});

describe('calculateIntervalImportCostScheduled', () => {
  const baseTariff: TariffVersion = {
    id: 'v1',
    validFromLocalDate: '2025-01-01',
    dayRate: 0.30,
    vatRate: 0.09,
  };

  it('costs a day-rate slot correctly with VAT', () => {
    const reading: IntervalReading = {
      intervalStartLocal: '2025-05-05T12:00',
      importKwh: 1,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 1,
    };
    const schedule = flatSchedule('p-day');
    const cost = calculateIntervalImportCostScheduled(reading, baseTariff, [stdDay], schedule);
    // 1 kWh × 0.30 × 1.09 = 0.327
    expect(cost).toBeCloseTo(0.327, 6);
  });

  it('costs a night-rate slot at the lower rate', () => {
    const reading: IntervalReading = {
      intervalStartLocal: '2025-05-05T23:00',
      importKwh: 2,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 2,
    };
    const schedule = dayNightSchedule('p-day', 'p-night', nightSlots);
    const cost = calculateIntervalImportCostScheduled(reading, baseTariff, [stdDay, stdNight], schedule);
    // 2 kWh × 0.15 × 1.09 = 0.327
    expect(cost).toBeCloseTo(0.327, 6);
  });

  it('costs a free-import slot as zero', () => {
    const reading: IntervalReading = {
      intervalStartLocal: '2025-05-05T12:00',
      importKwh: 5,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 5,
    };
    const schedule = flatSchedule('p-free');
    const cost = calculateIntervalImportCostScheduled(reading, baseTariff, [stdFree], schedule);
    expect(cost).toBe(0);
  });
});

describe('calculateBillingFromDailySummariesScheduled', () => {
  const scheduledTariff: ScheduledTariffVersion = {
    id: 'sv1',
    validFromLocalDate: '2025-01-01',
    dayRate: 0.30,
    nightRate: 0.15,
    vatRate: 0.09,
    pricePeriods: [stdDay, stdNight],
    weeklySchedule: dayNightSchedule('p-day', 'p-night', nightSlots),
  };

  it('uses bandBreakdown when present, applying per-period rates', () => {
    const breakdown: BandBreakdown = { 'p-day': 3, 'p-night': 1 };
    const summary: DailySummaryForBillingScheduled = {
      localDate: '2025-05-05',
      importKwh: 4,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 4,
      immersionDivertedKwh: 0,
      bandBreakdown: breakdown,
    };

    const result = calculateBillingFromDailySummariesScheduled(
      [summary],
      [scheduledTariff],
      [],
    );

    // (3 × 0.30 + 1 × 0.15) × 1.09 = 1.05 × 1.09 = 1.1445
    expect(result.actual.importCost).toBeCloseTo(1.1445, 4);
  });

  it('falls back to fixed-band fields when bandBreakdown is absent', () => {
    const summary: DailySummaryForBillingScheduled = {
      localDate: '2025-05-05',
      importKwh: 4,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 4,
      immersionDivertedKwh: 0,
      dayImportKwh: 3,
      nightImportKwh: 1,
      peakImportKwh: 0,
      bandBreakdown: null,
    };

    const result = calculateBillingFromDailySummariesScheduled(
      [summary],
      [scheduledTariff],
      [],
    );

    // Fixed-band: (3×0.30 + 1×0.15 + 0×0.30) × 1.09 = 1.1445
    expect(result.actual.importCost).toBeCloseTo(1.1445, 4);
  });

  it('falls back to day rate when neither breakdown nor band fields are present', () => {
    const summary: DailySummaryForBillingScheduled = {
      localDate: '2025-05-05',
      importKwh: 4,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 4,
      immersionDivertedKwh: 0,
      bandBreakdown: null,
    };

    const result = calculateBillingFromDailySummariesScheduled(
      [summary],
      [scheduledTariff],
      [],
    );

    // Day-rate only: 4 × 0.30 × 1.09 = 1.308
    expect(result.actual.importCost).toBeCloseTo(1.308, 4);
  });

  it('bills unknown breakdown period IDs at the day rate rather than dropping their kWh', () => {
    // A breakdown referencing a period ID not in pricePeriods (e.g. period was deleted)
    const breakdown: BandBreakdown = { 'p-day': 2, 'stale-period-id': 1 };
    const summary: DailySummaryForBillingScheduled = {
      localDate: '2025-05-05',
      importKwh: 3,
      exportKwh: 0,
      generatedKwh: 0,
      consumedKwh: 3,
      immersionDivertedKwh: 0,
      bandBreakdown: breakdown,
    };

    const result = calculateBillingFromDailySummariesScheduled(
      [summary],
      [scheduledTariff],
      [],
    );

    // 2 kWh × 0.30 (day) + 1 kWh × 0.30 (unknown → day fallback) = 3 × 0.30 × 1.09 = 0.981
    expect(result.actual.importCost).toBeCloseTo(0.981, 4);
  });
});
