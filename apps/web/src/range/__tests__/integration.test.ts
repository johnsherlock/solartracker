/**
 * Integration-style coverage for the range-summary slice.
 *
 * Exercises the full DB → domain → API computation pipeline using fixture data
 * that mirrors the seeded database (src/db/seed.ts). No live DB connection is
 * required: the fixtures replicate what loadIntervalReadingsForRange would
 * return from the seeded installation, giving confidence that the real slice
 * produces correct outputs for the data that actually lives in the dev database.
 *
 * Oct 2025 is BST (UTC+1) in Dublin, so each local day's midnight = UTC 23:00
 * of the previous day. Slot timestamps are constructed accordingly.
 */

import { describe, it, expect } from 'vitest';
import { allDatesInRange, computeRangeSummary } from '../billing';
import type { ScheduledTariffVersion, FixedChargeVersion } from '../../domain/billing';
import type { IntervalRow } from '../loader';

// ---------------------------------------------------------------------------
// Seed-mirror fixture constants
// IDs match src/db/seed.ts exactly so fixture and real DB are always in sync.
// ---------------------------------------------------------------------------

const TARIFF_VERSION_1_ID = '00000000-0000-0000-0000-000000000005';
const TARIFF_VERSION_2_ID = '00000000-0000-0000-0000-000000000006';
const FIXED_CHARGE_V1_ID  = '00000000-0000-0000-0000-000000000007';
const FIXED_CHARGE_V2_ID  = '00000000-0000-0000-0000-000000000008';

const TZ = 'Europe/Dublin';

/**
 * Tariff versions matching the seeded "Energia Smart 24h" plan.
 * V1: valid 2025-02-28 → 2025-10-09 (day rate 0.3451, export 0.2000, VAT 9%)
 * V2: valid 2025-10-10 → open     (day rate 0.3865, export 0.1850, VAT 9%)
 */
const seedTariffVersions: ScheduledTariffVersion[] = [
  {
    id: TARIFF_VERSION_1_ID,
    validFromLocalDate: '2025-02-28',
    validToLocalDate: '2025-10-09',
    dayRate: 0.3451,
    nightRate: 0.1848,
    peakRate: 0.3617,
    exportRate: 0.2000,
    vatRate: 0.09,
    discountRuleType: null,
    discountValue: null,
    nightStartLocalTime: '23:00',
    nightEndLocalTime: '08:00',
    peakStartLocalTime: '17:00',
    peakEndLocalTime: '19:00',
    pricePeriods: [],
    weeklySchedule: null,
  },
  {
    id: TARIFF_VERSION_2_ID,
    validFromLocalDate: '2025-10-10',
    validToLocalDate: null,
    dayRate: 0.3865,
    nightRate: 0.2125,
    peakRate: 0.4340,
    exportRate: 0.1850,
    vatRate: 0.09,
    discountRuleType: null,
    discountValue: null,
    nightStartLocalTime: '23:00',
    nightEndLocalTime: '08:00',
    peakStartLocalTime: '17:00',
    peakEndLocalTime: '19:00',
    pricePeriods: [],
    weeklySchedule: null,
  },
];

/**
 * Fixed charges matching the seeded standing charges.
 * V1: €0.59/day, V2: €0.66/day.
 */
const seedFixedCharges: FixedChargeVersion[] = [
  {
    id: FIXED_CHARGE_V1_ID,
    tariffPlanVersionId: TARIFF_VERSION_1_ID,
    chargeType: 'standing_charge',
    amount: 0.59,
    unit: 'per_day',
    validFromLocalDate: '2025-02-28',
    validToLocalDate: '2025-10-09',
  },
  {
    id: FIXED_CHARGE_V2_ID,
    tariffPlanVersionId: TARIFF_VERSION_2_ID,
    chargeType: 'standing_charge',
    amount: 0.66,
    unit: 'per_day',
    validFromLocalDate: '2025-10-10',
    validToLocalDate: null,
  },
];

/**
 * Build 48 half-hour interval rows for a BST local date (UTC+1).
 * Local midnight = UTC 23:00 of the previous calendar day.
 * Energy values are per-slot amounts (daily total ÷ 48).
 */
function makeBstDaySlots(
  localDate: string,
  perSlot: Partial<Omit<IntervalRow, 'intervalStart'>> = {},
): IntervalRow[] {
  // BST = UTC+1, so local midnight is UTC 23:00 of the previous day
  const [year, month, day] = localDate.split('-').map(Number);
  const t0 = Date.UTC(year, month - 1, day - 1, 23, 0, 0);
  return Array.from({ length: 48 }, (_, i) => ({
    intervalStart: new Date(t0 + i * 30 * 60 * 1000),
    importKwh: 0,
    generationKwh: 0,
    exportKwh: 0,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    consumedKwh: 0,
    readingCount: 30,
    ...perSlot,
  }));
}

// ---------------------------------------------------------------------------
// Seed data as interval rows.
// Daily totals from seed.ts distributed evenly across 48 slots.
// consumed = import + gen − export − immersionDiverted
// ---------------------------------------------------------------------------

const v1IntervalRows: IntervalRow[] = [
  ...makeBstDaySlots('2025-10-03', { importKwh:  7.5/48, exportKwh: 1.5/48, generationKwh: 4.2/48, consumedKwh:  9.2/48, immersionDivertedKwh: 1.0/48 }),
  ...makeBstDaySlots('2025-10-04', { importKwh: 11.2/48, exportKwh: 0.0/48, generationKwh: 0.8/48, consumedKwh: 12.0/48, immersionDivertedKwh: 0.0/48 }),
  ...makeBstDaySlots('2025-10-05', { importKwh:  9.8/48, exportKwh: 0.8/48, generationKwh: 3.1/48, consumedKwh: 11.5/48, immersionDivertedKwh: 0.6/48 }),
  ...makeBstDaySlots('2025-10-06', { importKwh: 12.4/48, exportKwh: 0.0/48, generationKwh: 0.4/48, consumedKwh: 12.8/48, immersionDivertedKwh: 0.0/48 }),
  ...makeBstDaySlots('2025-10-07', { importKwh:  8.9/48, exportKwh: 2.1/48, generationKwh: 5.0/48, consumedKwh: 10.6/48, immersionDivertedKwh: 1.2/48 }),
  ...makeBstDaySlots('2025-10-08', { importKwh: 10.3/48, exportKwh: 0.3/48, generationKwh: 2.5/48, consumedKwh: 12.1/48, immersionDivertedKwh: 0.4/48 }),
  ...makeBstDaySlots('2025-10-09', { importKwh: 13.1/48, exportKwh: 0.0/48, generationKwh: 0.2/48, consumedKwh: 13.3/48, immersionDivertedKwh: 0.0/48 }),
];

const v2IntervalRows: IntervalRow[] = [
  ...makeBstDaySlots('2025-10-10', { importKwh:  9.4/48, exportKwh: 1.0/48, generationKwh: 3.6/48, consumedKwh: 11.2/48, immersionDivertedKwh: 0.8/48 }),
  ...makeBstDaySlots('2025-10-11', { importKwh: 11.6/48, exportKwh: 0.0/48, generationKwh: 0.5/48, consumedKwh: 12.1/48, immersionDivertedKwh: 0.0/48 }),
  ...makeBstDaySlots('2025-10-12', { importKwh:  8.2/48, exportKwh: 1.8/48, generationKwh: 4.5/48, consumedKwh:  9.8/48, immersionDivertedKwh: 1.1/48 }),
  ...makeBstDaySlots('2025-10-13', { importKwh: 14.0/48, exportKwh: 0.0/48, generationKwh: 0.1/48, consumedKwh: 14.1/48, immersionDivertedKwh: 0.0/48 }),
  ...makeBstDaySlots('2025-10-14', { importKwh: 10.7/48, exportKwh: 0.5/48, generationKwh: 2.8/48, consumedKwh: 12.5/48, immersionDivertedKwh: 0.5/48 }),
  ...makeBstDaySlots('2025-10-15', { importKwh: 12.9/48, exportKwh: 0.0/48, generationKwh: 0.3/48, consumedKwh: 13.2/48, immersionDivertedKwh: 0.0/48 }),
  ...makeBstDaySlots('2025-10-16', { importKwh:  9.1/48, exportKwh: 1.2/48, generationKwh: 3.9/48, consumedKwh: 11.8/48, immersionDivertedKwh: 0.9/48 }),
];

const allSeedIntervals = [...v1IntervalRows, ...v2IntervalRows];

// ---------------------------------------------------------------------------
// Scenario 1: Full 14-day range spanning both tariff versions
// ---------------------------------------------------------------------------

describe('range-summary integration — full 14-day seeded range (2025-10-03 to 2025-10-16)', () => {
  const from = '2025-10-03';
  const to   = '2025-10-16';
  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummary(
    allSeedIntervals,
    allDates,
    TZ,
    seedTariffVersions,
    seedFixedCharges,
  );

  // --- health metadata ---

  it('reports 14 total days with full coverage', () => {
    expect(health.totalDays).toBe(14);
    expect(health.coveredDays).toBe(14);
    expect(health.missingDays).toBe(0);
    expect(health.missingDayDates).toEqual([]);
    expect(health.partialDays).toBe(0);
    expect(health.completenessRatio).toBe(1);
  });

  it('detects a tariff change spanning both versions', () => {
    expect(health.hasTariff).toBe(true);
    expect(health.hasTariffChange).toBe(true);
    expect(health.tariffVersionIds).toHaveLength(2);
    expect(health.tariffVersionIds).toContain(TARIFF_VERSION_1_ID);
    expect(health.tariffVersionIds).toContain(TARIFF_VERSION_2_ID);
    expect(health.setupWarnings).toEqual([]);
  });

  // --- output shape ---

  it('returns a series with one entry per requested day', () => {
    expect(series).toHaveLength(14);
    expect(series[0].date).toBe('2025-10-03');
    expect(series[13].date).toBe('2025-10-16');
  });

  it('includes billing for every day (all days have tariff coverage)', () => {
    const unbilledDays = series.filter((d) => d.billing === null);
    expect(unbilledDays).toHaveLength(0);
  });

  it('returns all required summary fields', () => {
    expect(summary).toMatchObject({
      actual: expect.objectContaining({
        importCost: expect.any(Number),
        fixedCharges: expect.any(Number),
        exportCredit: expect.any(Number),
        grossCost: expect.any(Number),
        netCost: expect.any(Number),
      }),
      withoutSolar: expect.objectContaining({
        importCost: expect.any(Number),
        fixedCharges: expect.any(Number),
        grossCost: expect.any(Number),
        netCost: expect.any(Number),
      }),
      solar: expect.objectContaining({
        savings: expect.any(Number),
        exportValue: expect.any(Number),
        selfConsumptionRatio: expect.any(Number),
        gridDependenceRatio: expect.any(Number),
      }),
      totals: expect.objectContaining({
        generatedKwh: expect.any(Number),
        importKwh: expect.any(Number),
        exportKwh: expect.any(Number),
        consumedKwh: expect.any(Number),
        immersionDivertedKwh: expect.any(Number),
      }),
    });
  });

  // --- key financial values ---

  it('accumulates correct combined standing charges for both tariff windows', () => {
    // V1: 7 days × €0.59 = €4.13, V2: 7 days × €0.66 = €4.62 → total €8.75
    expect(summary.actual.fixedCharges).toBeCloseTo(8.75, 2);
  });

  it('accumulates correct export credit across both tariff versions', () => {
    // V1 exports: 4.7 kWh × €0.20 = €0.94; V2 exports: 4.5 kWh × €0.185 = €0.8325
    expect(summary.actual.exportCredit).toBeCloseTo(1.77, 1);
  });

  it('produces a positive net cost after fixed charges and export credit', () => {
    expect(summary.actual.netCost).toBeGreaterThan(0);
    expect(summary.actual.grossCost).toBeGreaterThan(summary.actual.netCost);
  });

  it('produces positive solar savings across both tariff windows', () => {
    expect(summary.solar.savings).toBeGreaterThan(0);
    expect(summary.solar.exportValue).toBeCloseTo(summary.actual.exportCredit, 5);
  });

  it('accumulates correct energy totals', () => {
    expect(summary.totals.importKwh).toBeCloseTo(149.1, 1);
    expect(summary.totals.exportKwh).toBeCloseTo(9.2, 1);
    expect(summary.totals.generatedKwh).toBeCloseTo(31.9, 1);
    expect(summary.totals.immersionDivertedKwh).toBeCloseTo(6.5, 1);
  });

  // --- per-day series spot-checks ---

  it('computes correct billing for the first V1 day (2025-10-03)', () => {
    const day = series.find((d) => d.date === '2025-10-03')!;
    expect(day.isPartial).toBe(false);
    expect(day.generatedKwh).toBeCloseTo(4.2, 5);
    expect(day.importKwh).toBeCloseTo(7.5, 5);
    expect(day.exportKwh).toBeCloseTo(1.5, 5);
    // Flat-rate billing (no band splits): 7.5 × 0.3451 × 1.09 = 2.82
    // fixedCharge = 0.59; exportCredit = 1.5 × 0.20 = 0.30
    // actualNetCost = r2(2.82 + 0.59 − 0.30) = 3.11
    expect(day.billing!.importCost).toBeCloseTo(2.82, 1);
    expect(day.billing!.exportCredit).toBeCloseTo(0.30, 2);
    expect(day.billing!.actualNetCost).toBeCloseTo(3.11, 1);
    // withoutSolarImport = 7.5+4.2−1.5−1.0 = 9.2; withoutSolarNetCost = r2(9.2×0.3762+0.59) = 4.05
    // savings = r2(4.05 − 3.11) = 0.94
    expect(day.billing!.savings).toBeCloseTo(0.94, 1);
  });

  it('computes correct billing for the first V2 day (2025-10-10)', () => {
    const day = series.find((d) => d.date === '2025-10-10')!;
    expect(day.isPartial).toBe(false);
    // Flat-rate: 9.4 × 0.3865 × 1.09 = 3.96
    // fixedCharge = 0.66; exportCredit = 1.0 × 0.185 ≈ 0.185 (r2 of per-slot sum)
    // actualNetCost ≈ r2(3.96 + 0.66 − exportCredit)
    expect(day.billing!.importCost).toBeCloseTo(3.96, 1);
    expect(day.billing!.exportCredit).toBeCloseTo(0.185, 1);
    expect(day.billing!.actualNetCost).toBeCloseTo(4.43, 1);
    // withoutSolarImport = 9.4+3.6−1.0−0.8 = 11.2; withoutSolarNetCost = r2(11.2×0.4213+0.66) = 5.38
    // savings = r2(5.38 − 4.43) = 0.95
    expect(day.billing!.savings).toBeCloseTo(0.95, 1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: V1-only range — 7 days entirely under the first tariff version
// ---------------------------------------------------------------------------

describe('range-summary integration — V1-only range (2025-10-03 to 2025-10-09)', () => {
  const from = '2025-10-03';
  const to   = '2025-10-09';
  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummary(
    v1IntervalRows,
    allDates,
    TZ,
    seedTariffVersions,
    seedFixedCharges,
  );

  it('reports 7 fully covered days with no tariff change', () => {
    expect(health.totalDays).toBe(7);
    expect(health.coveredDays).toBe(7);
    expect(health.missingDays).toBe(0);
    expect(health.completenessRatio).toBe(1);
    expect(health.hasTariffChange).toBe(false);
    expect(health.tariffVersionIds).toHaveLength(1);
    expect(health.tariffVersionIds[0]).toBe(TARIFF_VERSION_1_ID);
    expect(health.hasTariff).toBe(true);
    expect(health.setupWarnings).toEqual([]);
  });

  it('returns 7 series entries, all with billing', () => {
    expect(series).toHaveLength(7);
    expect(series.every((d) => d.billing !== null)).toBe(true);
  });

  it('accumulates correct standing charges (7 × €0.59)', () => {
    expect(summary.actual.fixedCharges).toBeCloseTo(4.13, 2);
  });

  it('accumulates correct export credit at V1 rate (€0.20/kWh)', () => {
    // Exports: 1.5 + 0.8 + 2.1 + 0.3 = 4.7 kWh × €0.20 = €0.94
    expect(summary.actual.exportCredit).toBeCloseTo(0.94, 2);
  });

  it('accumulates correct import cost using flat day rate with VAT', () => {
    // 73.2 kWh × 0.3451 × 1.09 ≈ 27.53
    expect(summary.actual.importCost).toBeCloseTo(27.53, 1);
  });

  it('produces the correct net cost after fixed charges and export credit', () => {
    // grossCost ≈ 27.53 + 4.13 = 31.66; netCost ≈ 31.66 − 0.94 = 30.72
    expect(summary.actual.netCost).toBeCloseTo(30.72, 1);
  });

  it('produces correct solar savings over the V1 period', () => {
    // withoutSolarImport = 81.5 kWh; withoutSolarCost = 81.5×0.3451×1.09 ≈ 30.66
    // withoutSolarNetCost = 30.66 + 4.13 = 34.79
    // savings = 34.79 − 30.72 = 4.07
    expect(summary.solar.savings).toBeCloseTo(4.07, 1);
  });

  it('accumulates correct energy totals for V1 days', () => {
    expect(summary.totals.importKwh).toBeCloseTo(73.2, 1);
    expect(summary.totals.exportKwh).toBeCloseTo(4.7, 1);
    expect(summary.totals.generatedKwh).toBeCloseTo(16.2, 1);
    expect(summary.totals.immersionDivertedKwh).toBeCloseTo(3.2, 1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Range with a missing day — completeness < 1
// Requesting 2025-10-02 to 2025-10-09 but Oct 02 has no seeded interval rows.
// ---------------------------------------------------------------------------

describe('range-summary integration — range with one missing day (2025-10-02 to 2025-10-09)', () => {
  const from = '2025-10-02';
  const to   = '2025-10-09';
  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummary(
    v1IntervalRows,       // Oct 02 is not in this array
    allDates,
    TZ,
    seedTariffVersions,
    seedFixedCharges,
  );

  it('reports 8 total days, 7 covered, 1 missing', () => {
    expect(health.totalDays).toBe(8);
    expect(health.coveredDays).toBe(7);
    expect(health.missingDays).toBe(1);
    expect(health.missingDayDates).toEqual(['2025-10-02']);
    expect(health.completenessRatio).toBeCloseTo(7 / 8, 5);
  });

  it('returns 8 series entries including the missing day', () => {
    expect(series).toHaveLength(8);
  });

  it('sets the missing day to zeroed energy with null billing', () => {
    const missing = series[0];
    expect(missing.date).toBe('2025-10-02');
    expect(missing.generatedKwh).toBe(0);
    expect(missing.importKwh).toBe(0);
    expect(missing.exportKwh).toBe(0);
    expect(missing.isPartial).toBe(false);
    expect(missing.billing).toBeNull();
  });

  it('still computes billing for the 7 covered days', () => {
    const coveredDays = series.filter((d) => d.billing !== null);
    expect(coveredDays).toHaveLength(7);
    expect(series[1].date).toBe('2025-10-03');
    expect(series[1].billing).not.toBeNull();
  });

  it('excludes the missing day from financial totals', () => {
    expect(summary.totals.importKwh).toBeCloseTo(73.2, 1);
    expect(summary.actual.fixedCharges).toBeCloseTo(4.13, 2);
  });
});
