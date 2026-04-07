import { describe, it, expect } from 'vitest';
import { allDatesInRange, computeRangeSummary } from '../billing';
import type { TariffVersion, FixedChargeVersion } from '../../domain/billing';
import type { DailySummaryRow } from '../loader';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseTariff: TariffVersion = {
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

function makeRow(localDate: string, overrides?: Partial<DailySummaryRow>): DailySummaryRow {
  return {
    localDate,
    importKwh: 5,
    exportKwh: 3,
    generatedKwh: 8,
    consumedKwh: 10,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    isPartial: false,
    dayImportKwh: null,
    nightImportKwh: null,
    peakImportKwh: null,
    freeImportKwh: null,
    ...overrides,
  };
}

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
  const rows = [
    makeRow('2024-11-01'),
    makeRow('2024-11-02'),
    makeRow('2024-11-03'),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-03');

  it('returns correct energy totals', () => {
    const { summary } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    expect(summary.totals.importKwh).toBe(15);
    expect(summary.totals.exportKwh).toBe(9);
    expect(summary.totals.generatedKwh).toBe(24);
    expect(summary.totals.consumedKwh).toBe(30);
  });

  it('returns a series entry per requested date', () => {
    const { series } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    expect(series).toHaveLength(3);
    expect(series.map((s) => s.date)).toEqual(['2024-11-01', '2024-11-02', '2024-11-03']);
  });

  it('computes billing for each series day including fixed charges', () => {
    const { series } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    for (const day of series) {
      expect(day.billing).not.toBeNull();
      // importCost = r2(5 * 0.3 * 1.09) = r2(1.635) = 1.64
      // fixedCharges = 0.50 (standing charge per day)
      // exportCredit = r2(3 * 0.1) = 0.3
      // actualNetCost = r2(1.64 + 0.50 - 0.3) = r2(1.84) = 1.84
      expect(day.billing!.actualNetCost).toBeCloseTo(1.84, 2);
      expect(day.billing!.exportCredit).toBeCloseTo(0.3, 6);
    }
  });

  it('includes savings in billing > 0', () => {
    const { summary } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    expect(summary.solar.savings).toBeGreaterThan(0);
  });

  it('includes fixed charges in overall summary', () => {
    const { summary } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    // 3 days × £0.50 = £1.50
    expect(summary.actual.fixedCharges).toBeCloseTo(1.5, 5);
  });

  it('returns simplified-daily-rate note when rows have no band data', () => {
    const { summary } = computeRangeSummary(rows, allDates, [baseTariff], [standingCharge]);
    expect(summary.note).toBe('simplified-daily-rate');
  });

  it('returns banded-daily-rate note when all rows have band data', () => {
    const bandedRows = rows.map((r) => ({
      ...r,
      dayImportKwh: 2.75,
      nightImportKwh: 1.75,
      peakImportKwh: 0.5,
      freeImportKwh: null,
    }));
    const { summary } = computeRangeSummary(bandedRows, allDates, [baseTariff], [standingCharge]);
    expect(summary.note).toBe('banded-daily-rate');
  });

  it('uses banded rates when band data is present and tariff has night/peak rates', () => {
    const bandedTariff = {
      ...baseTariff,
      nightRate: 0.1,
      peakRate: 0.4,
      nightStartLocalTime: '23:00',
      nightEndLocalTime: '08:00',
      peakStartLocalTime: '17:00',
      peakEndLocalTime: '19:00',
    };
    // importKwh=5: day=2.75, night=1.75, peak=0.5 — bands sum to 5
    const bandedRow = makeRow('2024-11-01', { dayImportKwh: 2.75, nightImportKwh: 1.75, peakImportKwh: 0.5 });
    const { summary } = computeRangeSummary([bandedRow], allDatesInRange('2024-11-01', '2024-11-01'), [bandedTariff], []);
    // banded: (2.75×0.3 + 1.75×0.1 + 0.5×0.4) × 1.09 = (0.825+0.175+0.2) × 1.09 = 1.2 × 1.09 = 1.308
    // simplified would be: 5 × 0.3 × 1.09 = 1.635
    expect(summary.actual.importCost).toBeCloseTo(1.308, 2);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — tariff version change
// ---------------------------------------------------------------------------

describe('computeRangeSummary — tariff version change', () => {
  const tariffV1: TariffVersion = {
    ...baseTariff,
    id: 'tariff-v1',
    validFromLocalDate: '2024-11-01',
    validToLocalDate: '2024-11-02',
    dayRate: 0.25,
  };
  const tariffV2: TariffVersion = {
    ...baseTariff,
    id: 'tariff-v2',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
    dayRate: 0.35,
  };
  const rows = [
    makeRow('2024-11-01'),
    makeRow('2024-11-02'),
    makeRow('2024-11-03'),
    makeRow('2024-11-04'),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-04');

  it('detects hasTariffChange when two versions apply', () => {
    const { health } = computeRangeSummary(rows, allDates, [tariffV1, tariffV2], []);
    expect(health.hasTariffChange).toBe(true);
    expect(health.tariffVersionIds).toHaveLength(2);
    expect(health.tariffVersionIds).toContain('tariff-v1');
    expect(health.tariffVersionIds).toContain('tariff-v2');
  });

  it('does not flag hasTariffChange when only one version applies', () => {
    const { health } = computeRangeSummary(
      [makeRow('2024-11-03'), makeRow('2024-11-04')],
      allDatesInRange('2024-11-03', '2024-11-04'),
      [tariffV1, tariffV2],
      [],
    );
    expect(health.hasTariffChange).toBe(false);
    expect(health.tariffVersionIds).toEqual(['tariff-v2']);
  });

  it('applies different day rates for days in different tariff windows', () => {
    const { series } = computeRangeSummary(rows, allDates, [tariffV1, tariffV2], []);
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
  // 5-day range but only 3 rows
  const rows = [
    makeRow('2024-11-01'),
    makeRow('2024-11-03'),
    makeRow('2024-11-05'),
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-05');

  it('reports correct missing day count', () => {
    const { health } = computeRangeSummary(rows, allDates, [baseTariff], []);
    expect(health.totalDays).toBe(5);
    expect(health.coveredDays).toBe(3);
    expect(health.missingDays).toBe(2);
    expect(health.missingDayDates).toEqual(['2024-11-02', '2024-11-04']);
  });

  it('reports completeness ratio correctly', () => {
    const { health } = computeRangeSummary(rows, allDates, [baseTariff], []);
    expect(health.completenessRatio).toBeCloseTo(0.6, 5);
  });

  it('includes zero-value series entries for missing days', () => {
    const { series } = computeRangeSummary(rows, allDates, [baseTariff], []);
    const missing = series.filter((s) => ['2024-11-02', '2024-11-04'].includes(s.date));
    expect(missing).toHaveLength(2);
    for (const day of missing) {
      expect(day.generatedKwh).toBe(0);
      expect(day.importKwh).toBe(0);
      expect(day.billing).toBeNull();
    }
  });

  it('billing totals only include covered days (not missing zeros)', () => {
    const { summary } = computeRangeSummary(rows, allDates, [baseTariff], []);
    // 3 covered days × 5 kWh each
    expect(summary.totals.importKwh).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — no tariff data
// ---------------------------------------------------------------------------

describe('computeRangeSummary — no tariff', () => {
  const rows = [makeRow('2024-11-01'), makeRow('2024-11-02')];
  const allDates = allDatesInRange('2024-11-01', '2024-11-02');

  it('returns null billing for each series day', () => {
    const { series } = computeRangeSummary(rows, allDates, [], []);
    expect(series.every((s) => s.billing === null)).toBe(true);
  });

  it('reports hasTariff: false', () => {
    const { health } = computeRangeSummary(rows, allDates, [], []);
    expect(health.hasTariff).toBe(false);
  });

  it('includes a setup warning', () => {
    const { health } = computeRangeSummary(rows, allDates, [], []);
    expect(health.setupWarnings.length).toBeGreaterThan(0);
  });

  it('returns zero cost summary', () => {
    const { summary } = computeRangeSummary(rows, allDates, [], []);
    expect(summary.actual.netCost).toBe(0);
    expect(summary.solar.savings).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — rows outside tariff coverage window
// ---------------------------------------------------------------------------

describe('computeRangeSummary — rows outside tariff coverage', () => {
  // Tariff only covers from 2024-11-03 onward; rows 01-02 are outside.
  const partialTariff: TariffVersion = {
    ...baseTariff,
    id: 'tariff-partial',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
  };
  const rows = [
    makeRow('2024-11-01'),  // outside tariff window
    makeRow('2024-11-02'),  // outside tariff window
    makeRow('2024-11-03'),  // inside
    makeRow('2024-11-04'),  // inside
  ];
  const allDates = allDatesInRange('2024-11-01', '2024-11-04');

  it('does not throw when some rows fall outside tariff coverage', () => {
    expect(() =>
      computeRangeSummary(rows, allDates, [partialTariff], []),
    ).not.toThrow();
  });

  it('billing totals cover only tariff-covered rows', () => {
    const { summary } = computeRangeSummary(rows, allDates, [partialTariff], []);
    // Only 2 covered days (11-03, 11-04) contribute to billing
    expect(summary.actual.importCost).toBeGreaterThan(0);
    // importCost = 2 × (5 * 0.3 * 1.09) = 2 × 1.635 = 3.27
    expect(summary.actual.importCost).toBeCloseTo(3.27, 1);
  });

  it('series entries for uncovered days still have null billing', () => {
    const { series } = computeRangeSummary(rows, allDates, [partialTariff], []);
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
  // Only 11-01 and 11-03 have summary rows; 11-02 (the change boundary) is missing.
  const tariffV1: TariffVersion = {
    ...baseTariff,
    id: 'tariff-v1',
    validFromLocalDate: '2024-11-01',
    validToLocalDate: '2024-11-02',
  };
  const tariffV2: TariffVersion = {
    ...baseTariff,
    id: 'tariff-v2',
    validFromLocalDate: '2024-11-03',
    validToLocalDate: null,
  };
  const rows = [makeRow('2024-11-01'), makeRow('2024-11-03')]; // 11-02 missing
  const allDates = allDatesInRange('2024-11-01', '2024-11-03');

  it('detects hasTariffChange even when the boundary day has no summary', () => {
    const { health } = computeRangeSummary(rows, allDates, [tariffV1, tariffV2], []);
    expect(health.hasTariffChange).toBe(true);
    expect(health.tariffVersionIds).toContain('tariff-v1');
    expect(health.tariffVersionIds).toContain('tariff-v2');
  });
});

// ---------------------------------------------------------------------------
// calculateBillingFromDailySummaries — withoutSolarImport clamped to zero
// ---------------------------------------------------------------------------

describe('calculateBillingFromDailySummaries — withoutSolarImport clamped', () => {
  it('does not produce negative withoutSolarImportCost for bad data', () => {
    // Pathological row: immersion diverted exceeds what the formula allows,
    // which without clamping would give a negative withoutSolarImport.
    const badRow: DailySummaryRow = {
      localDate: '2024-11-01',
      importKwh: 1,
      exportKwh: 0,
      generatedKwh: 2,
      consumedKwh: 3,
      immersionDivertedKwh: 100, // implausibly large — would make withoutSolarImport negative
      immersionBoostedKwh: 0,
      isPartial: false,
      dayImportKwh: null,
      nightImportKwh: null,
      peakImportKwh: null,
      freeImportKwh: null,
    };
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { summary } = computeRangeSummary([badRow], allDates, [baseTariff], []);
    expect(summary.withoutSolar.importCost).toBeGreaterThanOrEqual(0);
    expect(summary.withoutSolar.netCost).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — per-day savings includes export credit
// ---------------------------------------------------------------------------

describe('computeRangeSummary — per-day savings includes export credit', () => {
  it('savings equals withoutSolarCost minus actualNetCost', () => {
    const rows = [makeRow('2024-11-01', { importKwh: 5, exportKwh: 3, generatedKwh: 8, consumedKwh: 10, immersionDivertedKwh: 0 })];
    const allDates = allDatesInRange('2024-11-01', '2024-11-01');
    const { series } = computeRangeSummary(rows, allDates, [baseTariff], []);
    const day = series[0];
    // actualNetCost = r2(importCost - exportCredit) = r2(1.635 - 0.3) = 1.34
    // withoutSolarImport = 5 + 8 - 3 - 0 = 10
    // withoutSolarCost = r2(10 * 0.3 * 1.09) = r2(3.27) = 3.27
    // savings = r2(3.27 - 1.34) = r2(1.93) = 1.93
    expect(day.billing!.savings).toBeCloseTo(1.93, 2);
    // Savings must be higher than if export credit were excluded (1.635)
    expect(day.billing!.savings).toBeGreaterThan(day.billing!.actualNetCost);
  });
});

// ---------------------------------------------------------------------------
// computeRangeSummary — partial days
// ---------------------------------------------------------------------------

describe('computeRangeSummary — partial days', () => {
  it('reports partial day count', () => {
    const rows = [
      makeRow('2024-11-01', { isPartial: false }),
      makeRow('2024-11-02', { isPartial: true }),
      makeRow('2024-11-03', { isPartial: true }),
    ];
    const allDates = allDatesInRange('2024-11-01', '2024-11-03');
    const { health } = computeRangeSummary(rows, allDates, [baseTariff], []);
    expect(health.partialDays).toBe(2);
  });
});
