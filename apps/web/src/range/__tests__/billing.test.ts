import { describe, it, expect } from 'vitest';
import { allDatesInRange, computeRangeSummary } from '../billing';
import type { ScheduledTariffVersion, FixedChargeVersion } from '../../domain/billing';
import type { IntervalRow } from '../loader';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// All test dates are Nov/winter in Dublin (UTC+0 = local), so local midnight = UTC midnight.

const TZ = 'Europe/Dublin';

const baseTariff: ScheduledTariffVersion = {
  id: 'tariff-v1',
  validFromLocalDate: '2024-01-01',
  validToLocalDate: null,
  dayRate: 0.3,
  nightRate: null,
  peakRate: null,
  exportRate: 0.1,
  vatRate: 0.09,
  discountRuleType: null,
  discountValue: null,
  nightStartLocalTime: null,
  nightEndLocalTime: null,
  peakStartLocalTime: null,
  peakEndLocalTime: null,
  pricePeriods: [],
  weeklySchedule: null,
};

const standingCharge: FixedChargeVersion = {
  id: 'charge-v1',
  tariffPlanVersionId: 'tariff-v1',
  chargeType: 'standing_charge',
  amount: 0.50,
  unit: 'per_day',
  validFromLocalDate: '2024-01-01',
  validToLocalDate: null,
};

/**
 * Build `count` half-hour interval rows starting at `utcStartISO`.
 * Energy values are per-slot amounts; multiply by 48 to get daily totals.
 */
function makeDaySlots(
  utcStartISO: string,
  count = 48,
  perSlot: Partial<Omit<IntervalRow, 'intervalStart'>> = {},
  readingCount = 30,
): IntervalRow[] {
  const t0 = new Date(utcStartISO).getTime();
  return Array.from({ length: count }, (_, i) => ({
    intervalStart: new Date(t0 + i * 30 * 60 * 1000),
    importKwh: 0,
    generationKwh: 0,
    exportKwh: 0,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    consumedKwh: 0,
    readingCount,
    ...perSlot,
  }));
}

// Standard per-slot energy (daily totals: import=5, export=3, gen=8, consumed=10)
const STD: Partial<Omit<IntervalRow, 'intervalStart'>> = {
  importKwh: 5 / 48,
  exportKwh: 3 / 48,
  generationKwh: 8 / 48,
  consumedKwh: 10 / 48,
  immersionDivertedKwh: 0,
};

// ---------------------------------------------------------------------------
// allDatesInRange
// ---------------------------------------------------------------------------

describe('allDatesInRange', () => {
  it('returns a single date for a same-day range', () => {
    expect(allDatesInRange('2024-11-01', '2024-11-01')).toEqual(['2024-11-01']);
  });

  it('returns all dates inclusive', () => {
    const dates = allDatesInRange('2024-11-01', '2024-11-03');
    expect(dates).toEqual(['2024-11-01', '2024-11-02', '2024-11-03']);
  });

  it('handles a month boundary', () => {
    const dates = allDatesInRange('2024-10-30', '2024-11-02');
    expect(dates).toEqual(['2024-10-30', '2024-10-31', '2024-11-01', '2024-11-02']);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — basic billing
// ---------------------------------------------------------------------------

describe('computeRangeSummary — basic billing', () => {
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-02T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-03');

  it('returns correct energy totals', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], [standingCharge]);
    expect(summary.totals.importKwh).toBeCloseTo(15, 5);
    expect(summary.totals.exportKwh).toBeCloseTo(9, 5);
    expect(summary.totals.generatedKwh).toBeCloseTo(24, 5);
    expect(summary.totals.consumedKwh).toBeCloseTo(30, 5);
  });

  it('returns a series entry per requested date', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], [standingCharge]);
    expect(series).toHaveLength(3);
    expect(series.map((s) => s.date)).toEqual(['2024-11-01', '2024-11-02', '2024-11-03']);
  });

  it('computes billing for each series day including fixed charges', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], [standingCharge]);
    for (const day of series) {
      expect(day.billing).not.toBeNull();
      // importCost = r2(5 × 0.3 × 1.09) = r2(1.635) = 1.64
      // fixedCharges = 0.50 per day
      // exportCredit = r2(3 × 0.1) = 0.3
      // actualNetCost = r2(1.64 + 0.50 − 0.3) = 1.84
      expect(day.billing!.actualNetCost).toBeCloseTo(1.84, 2);
      expect(day.billing!.exportCredit).toBeCloseTo(0.3, 6);
      expect(day.billing!.importCost).toBeCloseTo(1.64, 2);
      expect(day.billing!.fixedCharges).toBeCloseTo(0.5, 6);
    }
  });

  it('includes savings > 0', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], [standingCharge]);
    expect(summary.solar.savings).toBeGreaterThan(0);
  });

  it('includes fixed charges in overall summary', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], [standingCharge]);
    // 3 days × €0.50 = €1.50
    expect(summary.actual.fixedCharges).toBeCloseTo(1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — tariff version change
// ---------------------------------------------------------------------------

describe('computeRangeSummary — tariff version change', () => {
  const tariffV1: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-v1',
    validFromLocalDate: '2024-11-01',
    validToLocalDate: '2024-11-02',
    dayRate: 0.25,
  };
  const tariffV2: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-v2',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
    dayRate: 0.35,
  };
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-02T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-04T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-04');

  it('detects hasTariffChange when two versions apply', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [tariffV1, tariffV2], []);
    expect(health.hasTariffChange).toBe(true);
    expect(health.tariffVersionIds).toHaveLength(2);
    expect(health.tariffVersionIds).toContain('tariff-v1');
    expect(health.tariffVersionIds).toContain('tariff-v2');
  });

  it('does not flag hasTariffChange when only one version applies', () => {
    const { health } = computeRangeSummary(
      [...makeDaySlots('2024-11-03T00:00:00Z', 48, STD), ...makeDaySlots('2024-11-04T00:00:00Z', 48, STD)],
      allDatesInRange('2024-11-03', '2024-11-04'),
      TZ,
      [tariffV1, tariffV2],
      [],
    );
    expect(health.hasTariffChange).toBe(false);
    expect(health.tariffVersionIds).toEqual(['tariff-v2']);
  });

  it('applies different day rates for days in different tariff windows', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [tariffV1, tariffV2], []);
    const day1 = series.find((s) => s.date === '2024-11-01')!;
    const day3 = series.find((s) => s.date === '2024-11-03')!;
    // day1 uses 0.25 rate, day3 uses 0.35 rate — same import so day3 costs more
    expect(day3.billing!.actualNetCost).toBeGreaterThan(day1.billing!.actualNetCost);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — missing days
// ---------------------------------------------------------------------------

describe('computeRangeSummary — missing days', () => {
  // 5-day range but only intervals for Nov 1, 3, 5
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-05T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-05');

  it('reports correct missing day count', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    expect(health.totalDays).toBe(5);
    expect(health.coveredDays).toBe(3);
    expect(health.missingDays).toBe(2);
    expect(health.missingDayDates).toEqual(['2024-11-02', '2024-11-04']);
  });

  it('reports completeness ratio correctly', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    expect(health.completenessRatio).toBeCloseTo(0.6, 5);
  });

  it('includes zero-value series entries for missing days', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    const missing = series.filter((s) => ['2024-11-02', '2024-11-04'].includes(s.date));
    expect(missing).toHaveLength(2);
    for (const day of missing) {
      expect(day.generatedKwh).toBe(0);
      expect(day.importKwh).toBe(0);
      expect(day.billing).toBeNull();
    }
  });

  it('billing totals only include covered days (not missing zeros)', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    // 3 covered days × 5 kWh each
    expect(summary.totals.importKwh).toBeCloseTo(15, 5);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — no tariff data
// ---------------------------------------------------------------------------

describe('computeRangeSummary — no tariff', () => {
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-02T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-02');

  it('returns null billing for each series day', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [], []);
    expect(series.every((s) => s.billing === null)).toBe(true);
  });

  it('reports hasTariff: false', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [], []);
    expect(health.hasTariff).toBe(false);
  });

  it('includes a setup warning', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [], []);
    expect(health.setupWarnings.length).toBeGreaterThan(0);
  });

  it('returns zero cost summary', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [], []);
    expect(summary.actual.netCost).toBe(0);
    expect(summary.solar.savings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — rows outside tariff coverage window
// ---------------------------------------------------------------------------

describe('computeRangeSummary — rows outside tariff coverage', () => {
  // Tariff only covers from 2024-11-03; Nov 01-02 intervals are outside.
  const partialTariff: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-partial',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
  };
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-02T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-04T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-04');

  it('does not throw when some intervals fall outside tariff coverage', () => {
    expect(() =>
      computeRangeSummary(intervals, allDates, TZ, [partialTariff], []),
    ).not.toThrow();
  });

  it('billing totals cover only tariff-covered days', () => {
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [partialTariff], []);
    // Only 2 covered days (11-03, 11-04): 2 × (5 × 0.3 × 1.09) = 2 × 1.635 = 3.27
    expect(summary.actual.importCost).toBeCloseTo(3.27, 1);
  });

  it('series entries for uncovered days still have null billing', () => {
    const { series } = computeRangeSummary(intervals, allDates, TZ, [partialTariff], []);
    expect(series.find((s) => s.date === '2024-11-01')!.billing).toBeNull();
    expect(series.find((s) => s.date === '2024-11-02')!.billing).toBeNull();
    expect(series.find((s) => s.date === '2024-11-03')!.billing).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — tariff change detected on missing days
// ---------------------------------------------------------------------------

describe('computeRangeSummary — tariff change on missing day', () => {
  // v1 covers 11-01 to 11-02, v2 covers 11-03 onward.
  // Only 11-01 and 11-03 have intervals; 11-02 (the change boundary) is missing.
  const tariffV1: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-v1',
    validFromLocalDate: '2024-11-01',
    validToLocalDate: '2024-11-02',
  };
  const tariffV2: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-v2',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
  };
  const intervals = [
    ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD),
    ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-03');

  it('detects hasTariffChange even when the boundary day has no intervals', () => {
    const { health } = computeRangeSummary(intervals, allDates, TZ, [tariffV1, tariffV2], []);
    expect(health.hasTariffChange).toBe(true);
    expect(health.tariffVersionIds).toContain('tariff-v1');
    expect(health.tariffVersionIds).toContain('tariff-v2');
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — withoutSolarImport clamped to zero
// ---------------------------------------------------------------------------

describe('computeRangeSummary — withoutSolarImport clamped', () => {
  it('does not produce negative withoutSolarImportCost for pathological data', () => {
    // Pathological slot: immersionDiverted far exceeds generation — without clamping
    // withoutSolarImport would be negative.
    const intervals = makeDaySlots('2024-11-01T00:00:00Z', 48, {
      importKwh: 1 / 48,
      generationKwh: 2 / 48,
      exportKwh: 0,
      immersionDivertedKwh: 100 / 48, // implausibly large
    });
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    expect(summary.withoutSolar.importCost).toBeGreaterThanOrEqual(0);
    expect(summary.withoutSolar.netCost).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — per-day savings includes export credit
// ---------------------------------------------------------------------------

describe('computeRangeSummary — per-day savings includes export credit', () => {
  it('savings equals withoutSolarNetCost minus actualNetCost', () => {
    // daily totals: import=5, export=3, gen=8, immersionDiverted=0
    const intervals = makeDaySlots('2024-11-01T00:00:00Z', 48, {
      importKwh: 5 / 48,
      exportKwh: 3 / 48,
      generationKwh: 8 / 48,
      consumedKwh: 10 / 48,
      immersionDivertedKwh: 0,
    });
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    // No fixed charges so billing is purely import vs export
    const { series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    const day = series[0];
    // importCost = r2(5 × 0.3 × 1.09) = 1.64; exportCredit = r2(3 × 0.1) = 0.3
    // actualNetCost = r2(1.64 − 0.3) = 1.34
    // withoutSolarImport = 5 + 8 − 3 − 0 = 10; withoutSolarCost = r2(10 × 0.327) = 3.27
    // savings = r2(3.27 − 1.34) = 1.93
    expect(day.billing!.savings).toBeCloseTo(1.93, 2);
    // Savings must exceed the actual net cost (export credit makes savings higher)
    expect(day.billing!.savings).toBeGreaterThan(day.billing!.actualNetCost);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — partial days
// ---------------------------------------------------------------------------

describe('computeRangeSummary — partial days', () => {
  it('reports partial day count when captured minutes fall below 90%', () => {
    const intervals = [
      ...makeDaySlots('2024-11-01T00:00:00Z', 48, STD, 30), // full
      ...makeDaySlots('2024-11-02T00:00:00Z', 48, STD, 27), // exactly 90% complete
      ...makeDaySlots('2024-11-03T00:00:00Z', 48, STD, 26), // below 90%
    ];
    const allDates = allDatesInRange('2024-11-01', '2024-11-03');
    const { health, series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    expect(health.partialDays).toBe(1);
    expect(series.find((day) => day.date === '2024-11-02')!.isPartial).toBe(false);
    expect(series.find((day) => day.date === '2024-11-03')!.isPartial).toBe(true);
  });

  it('detects a partial day when whole-slot gaps push coverage below 90%', () => {
    // 43 of 48 expected slots = 89.6% coverage, so the day is partial
    const intervals = makeDaySlots('2024-11-01T00:00:00Z', 43, STD, 30);
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { health } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    expect(health.partialDays).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — selfConsumedSolarValue exposed in output
// ---------------------------------------------------------------------------

describe('computeRangeSummary — selfConsumedSolarValue', () => {
  it('exposes selfConsumedSolarValue in per-day billing', () => {
    // import=5, gen=8, export=3, immersionDiverted=0 → selfConsumed = 8-3-0 = 5 kWh
    const intervals = makeDaySlots('2024-11-01T00:00:00Z', 48, {
      importKwh: 5 / 48,
      generationKwh: 8 / 48,
      exportKwh: 3 / 48,
      consumedKwh: 10 / 48,
      immersionDivertedKwh: 0,
    });
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    const day = series[0];
    // selfConsumed = 5 kWh, import rate = 0.3, VAT = 1.09
    // selfConsumedSolarValue = r2(5 × 0.3 × 1.09) = r2(1.635) = 1.64
    expect(day.billing!.selfConsumedSolarValue).toBeCloseTo(1.64, 2);
  });

  it('exposes selfConsumedSolarValue in summary.solar', () => {
    const intervals = [
      ...makeDaySlots('2024-11-01T00:00:00Z', 48, {
        importKwh: 5 / 48, generationKwh: 8 / 48, exportKwh: 3 / 48,
        consumedKwh: 10 / 48, immersionDivertedKwh: 0,
      }),
      ...makeDaySlots('2024-11-02T00:00:00Z', 48, {
        importKwh: 5 / 48, generationKwh: 8 / 48, exportKwh: 3 / 48,
        consumedKwh: 10 / 48, immersionDivertedKwh: 0,
      }),
    ];
    const allDates = allDatesInRange('2024-11-01', '2024-11-02');
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [baseTariff], []);
    // 2 days × 1.635 = 3.27
    expect(summary.solar.selfConsumedSolarValue).toBeCloseTo(3.27, 1);
  });

  it('returns zero selfConsumedSolarValue when no tariff', () => {
    const intervals = makeDaySlots('2024-11-01T00:00:00Z', 48, STD);
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { summary } = computeRangeSummary(intervals, allDates, TZ, [], []);
    expect(summary.solar.selfConsumedSolarValue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — U-054 worked example
// ---------------------------------------------------------------------------

describe('computeRangeSummary — U-054 worked example', () => {
  // One day, simplified to a single slot for clarity (48 identical slots, daily totals):
  //   import = 2 kWh, generation = 5 kWh, export = 1 kWh, consumed = 6 kWh, immersion = 0
  //   import rate = 0.30/kWh, export rate = 0.10/kWh, VAT = 0%, no fixed charges
  //
  // Expected:
  //   selfConsumed            = gen − export − immersion = 5 − 1 − 0 = 4 kWh
  //   selfConsumedSolarValue  = 4 × 0.30 = €1.20
  //   exportCredit            = 1 × 0.10 = €0.10
  //   totalSolarValue         = 1.20 + 0.10 = €1.30
  //   importCost              = 2 × 0.30 = €0.60
  //   netEnergyBill           = importCost − exportCredit = 0.60 − 0.10 = €0.50
  //   withoutSolarImport      = import + gen − export − immersion = 2+5−1−0 = 6 kWh
  //   withoutSolarCost        = 6 × 0.30 = €1.80
  //   billReductionFromSolar  = withoutSolarCost − netEnergyBill = 1.80 − 0.50 = €1.30
  //   (= totalSolarValue ✓)

  const noVatTariff: ScheduledTariffVersion = {
    ...baseTariff,
    id: 'tariff-no-vat',
    vatRate: 0,
    exportRate: 0.10,
    dayRate: 0.30,
  };

  const intervals = makeDaySlots('2024-11-01T00:00:00Z', 48, {
    importKwh: 2 / 48,
    generationKwh: 5 / 48,
    exportKwh: 1 / 48,
    consumedKwh: 6 / 48,
    immersionDivertedKwh: 0,
  });

  it('selfConsumedSolarValue = self-consumed kWh × import rate', () => {
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [noVatTariff], []);
    expect(series[0].billing!.selfConsumedSolarValue).toBeCloseTo(1.20, 2);
  });

  it('totalSolarValue = selfConsumedSolarValue + exportCredit', () => {
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [noVatTariff], []);
    const b = series[0].billing!;
    const totalSolarValue = b.selfConsumedSolarValue + b.exportCredit;
    expect(totalSolarValue).toBeCloseTo(1.30, 2);
  });

  it('billReductionFromSolar = totalSolarValue (per-slot pricing equivalence)', () => {
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [noVatTariff], []);
    const b = series[0].billing!;
    const netEnergyBill = b.importCost - b.exportCredit;           // 0.60 − 0.10 = 0.50
    const withoutSolarNetCost = b.actualNetCost + b.savings;        // approximation
    const billReduction = withoutSolarNetCost - netEnergyBill;
    const totalSolarValue = b.selfConsumedSolarValue + b.exportCredit;
    // With per-slot same-rate pricing, billReduction and totalSolarValue are equal
    expect(billReduction).toBeCloseTo(totalSolarValue, 2);
  });

  it('importCost is the tariff-priced actual import bill before export credit', () => {
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [noVatTariff], []);
    expect(series[0].billing!.importCost).toBeCloseTo(0.60, 2);
  });

  it('exportCredit is the tariff-priced value of exported energy', () => {
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(intervals, allDates, TZ, [noVatTariff], []);
    expect(series[0].billing!.exportCredit).toBeCloseTo(0.10, 2);
  });
});
