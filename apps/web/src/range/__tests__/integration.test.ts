/**
 * Integration-style coverage for the range-summary slice (Q-008).
 *
 * Exercises the full DB → domain → API computation pipeline using fixture data
 * that exactly mirrors the seeded database (src/db/seed.ts). No live DB
 * connection is required: the fixtures replicate what the loaders would return
 * from the seeded installation, giving confidence that the real slice produces
 * correct outputs for the data that actually lives in the dev database.
 */

import { describe, it, expect } from 'vitest';
import { allDatesInRange, computeRangeSummary } from '../billing';
import type { ScheduledTariffVersion, FixedChargeVersion } from '../../domain/billing';
import type { DailySummaryRow } from '../loader';

// ---------------------------------------------------------------------------
// Seed-mirror fixture constants
// IDs match src/db/seed.ts exactly so fixture and real DB are always in sync.
// ---------------------------------------------------------------------------

const TARIFF_VERSION_1_ID = '00000000-0000-0000-0000-000000000005';
const TARIFF_VERSION_2_ID = '00000000-0000-0000-0000-000000000006';
const FIXED_CHARGE_V1_ID  = '00000000-0000-0000-0000-000000000007';
const FIXED_CHARGE_V2_ID  = '00000000-0000-0000-0000-000000000008';

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
 * Approximate band splits matching the seeded bandSplit() logic in seed.ts.
 * night ≈ 35%, peak ≈ 10%, day = remainder. Values must sum to importKwh.
 */
function bandSplit(importKwh: number) {
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  const night = r4(importKwh * 0.35);
  const peak  = r4(importKwh * 0.10);
  const day   = r4(importKwh - night - peak);
  return { dayImportKwh: day, nightImportKwh: night, peakImportKwh: peak, freeImportKwh: null, bandBreakdown: null };
}

/**
 * Daily summaries matching the seeded rows in src/db/seed.ts.
 * V1 period: 2025-10-03 to 2025-10-09 (7 days, day rate pre rate-change)
 * V2 period: 2025-10-10 to 2025-10-16 (7 days, day rate post rate-change)
 * consumed = import + generated − export − immersionDiverted
 * Band splits use the same approximate percentages as seed.ts.
 */
const v1SummaryRows: DailySummaryRow[] = [
  { localDate: '2025-10-03', importKwh:  7.5, exportKwh: 1.5, generatedKwh: 4.2, consumedKwh:  9.2, immersionDivertedKwh: 1.0, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 7.5) },
  { localDate: '2025-10-04', importKwh: 11.2, exportKwh: 0.0, generatedKwh: 0.8, consumedKwh: 12.0, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit(11.2) },
  { localDate: '2025-10-05', importKwh:  9.8, exportKwh: 0.8, generatedKwh: 3.1, consumedKwh: 11.5, immersionDivertedKwh: 0.6, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 9.8) },
  { localDate: '2025-10-06', importKwh: 12.4, exportKwh: 0.0, generatedKwh: 0.4, consumedKwh: 12.8, immersionDivertedKwh: 0.0, immersionBoostedKwh: 1.2, isPartial: false, ...bandSplit(12.4) },
  { localDate: '2025-10-07', importKwh:  8.9, exportKwh: 2.1, generatedKwh: 5.0, consumedKwh: 10.6, immersionDivertedKwh: 1.2, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 8.9) },
  { localDate: '2025-10-08', importKwh: 10.3, exportKwh: 0.3, generatedKwh: 2.5, consumedKwh: 12.1, immersionDivertedKwh: 0.4, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit(10.3) },
  { localDate: '2025-10-09', importKwh: 13.1, exportKwh: 0.0, generatedKwh: 0.2, consumedKwh: 13.3, immersionDivertedKwh: 0.0, immersionBoostedKwh: 2.0, isPartial: false, ...bandSplit(13.1) },
];

const v2SummaryRows: DailySummaryRow[] = [
  { localDate: '2025-10-10', importKwh:  9.4, exportKwh: 1.0, generatedKwh: 3.6, consumedKwh: 11.2, immersionDivertedKwh: 0.8, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 9.4) },
  { localDate: '2025-10-11', importKwh: 11.6, exportKwh: 0.0, generatedKwh: 0.5, consumedKwh: 12.1, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit(11.6) },
  { localDate: '2025-10-12', importKwh:  8.2, exportKwh: 1.8, generatedKwh: 4.5, consumedKwh:  9.6, immersionDivertedKwh: 1.1, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 8.2) },
  { localDate: '2025-10-13', importKwh: 14.0, exportKwh: 0.0, generatedKwh: 0.1, consumedKwh: 14.1, immersionDivertedKwh: 0.0, immersionBoostedKwh: 1.5, isPartial: false, ...bandSplit(14.0) },
  { localDate: '2025-10-14', importKwh: 10.7, exportKwh: 0.5, generatedKwh: 2.8, consumedKwh: 12.5, immersionDivertedKwh: 0.5, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit(10.7) },
  { localDate: '2025-10-15', importKwh: 12.9, exportKwh: 0.0, generatedKwh: 0.3, consumedKwh: 13.2, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.8, isPartial: false, ...bandSplit(12.9) },
  { localDate: '2025-10-16', importKwh:  9.1, exportKwh: 1.2, generatedKwh: 3.9, consumedKwh: 11.8, immersionDivertedKwh: 0.9, immersionBoostedKwh: 0.0, isPartial: false, ...bandSplit( 9.1) },
];

const allSeedRows = [...v1SummaryRows, ...v2SummaryRows];

// ---------------------------------------------------------------------------
// Scenario 1: Full 14-day range spanning both tariff versions
// ---------------------------------------------------------------------------

describe('range-summary integration — full 14-day seeded range (2025-10-03 to 2025-10-16)', () => {
  const from = '2025-10-03';
  const to   = '2025-10-16';
  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummary(
    allSeedRows,
    allDates,
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
      note: 'banded-daily-rate',
    });
  });

  // --- key financial values ---

  it('accumulates correct combined standing charges for both tariff windows', () => {
    // V1: 7 days × €0.59 = €4.13, V2: 7 days × €0.66 = €4.62 → total €8.75
    expect(summary.actual.fixedCharges).toBeCloseTo(8.75, 2);
  });

  it('accumulates correct export credit across both tariff versions', () => {
    // V1 exports (rate 0.20): 1.5+0.8+2.1+0.3 = 4.7 kWh → €0.94
    // V2 exports (rate 0.185): 1.0+1.8+0.5+1.2 = 4.5 kWh → ~€0.8325
    // Total ≈ €1.77
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
    // V1 + V2 sums from seed data
    expect(summary.totals.importKwh).toBeCloseTo(73.2 + 75.9, 1);       // 149.1
    expect(summary.totals.exportKwh).toBeCloseTo(4.7 + 4.5, 1);         // 9.2
    expect(summary.totals.generatedKwh).toBeCloseTo(16.2 + 15.7, 1);    // 31.9
    expect(summary.totals.immersionDivertedKwh).toBeCloseTo(3.2 + 3.3, 1); // 6.5
  });

  // --- per-day series spot-checks ---

  it('exposes band import fields on series days', () => {
    const day = series.find((d) => d.date === '2025-10-03')!;
    // bandSplit(7.5): night=2.625, peak=0.75, day=4.125
    expect(day.dayImportKwh).toBeCloseTo(4.125, 4);
    expect(day.nightImportKwh).toBeCloseTo(2.625, 4);
    expect(day.peakImportKwh).toBeCloseTo(0.75, 4);
    // bands sum to total import
    expect((day.dayImportKwh ?? 0) + (day.nightImportKwh ?? 0) + (day.peakImportKwh ?? 0)).toBeCloseTo(7.5, 4);
  });

  it('computes correct billing for the first V1 day (2025-10-03)', () => {
    const day = series.find((d) => d.date === '2025-10-03')!;
    expect(day.isPartial).toBe(false);
    expect(day.generatedKwh).toBe(4.2);
    expect(day.importKwh).toBe(7.5);
    expect(day.exportKwh).toBe(1.5);
    // Banded: day=4.125×0.3451 + night=2.625×0.1848 + peak=0.75×0.3617, all ×1.09
    // rawImportCost = (1.42351+0.4851+0.27128)×1.09 = 2.37608 → r2 = 2.38
    // fixedCharge = 0.59, exportCredit = r2(1.5 × 0.20) = 0.30
    // actualNetCost = r2(2.38 + 0.59 − 0.30) = 2.67
    expect(day.billing!.actualNetCost).toBeCloseTo(2.67, 1);
    expect(day.billing!.exportCredit).toBeCloseTo(0.30, 2);
    // withoutSolarImport = 9.2 (day rate on baseline — documented simplification)
    // withoutSolarCost = r2(9.2 × 0.3451 × 1.09) = 3.46; withoutSolarNetCost = 4.05
    // savings = r2(4.05 − 2.67) = 1.38
    expect(day.billing!.savings).toBeCloseTo(1.38, 1);
  });

  it('computes correct billing for the first V2 day (2025-10-10)', () => {
    const day = series.find((d) => d.date === '2025-10-10')!;
    expect(day.isPartial).toBe(false);
    // Banded: day=5.17×0.3865 + night=3.29×0.2125 + peak=0.94×0.4340, all ×1.09
    // rawImportCost = (1.99821+0.69913+0.40796)×1.09 = 3.38478 → r2 = 3.38
    // fixedCharge = 0.66, exportCredit = r2(1.0 × 0.185) = 0.19
    // actualNetCost = r2(3.38 + 0.66 − 0.19) = 3.85
    expect(day.billing!.actualNetCost).toBeCloseTo(3.85, 1);
    expect(day.billing!.exportCredit).toBeCloseTo(0.19, 2);
    // withoutSolarImport = 11.2; withoutSolarNetCost = r2(r2(11.2 × 0.3865 × 1.09) + 0.66) = 5.38
    // savings = r2(5.38 − 3.85) = 1.53
    expect(day.billing!.savings).toBeCloseTo(1.53, 1);
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
    v1SummaryRows,
    allDates,
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

  it('accumulates correct import cost using banded rates with VAT', () => {
    // Banded billing: night(35%)×0.1848 + peak(10%)×0.3617 + day(55%)×0.3451, all ×1.09
    // Pre-computed from bandSplit() applied to each V1 day ≈ €23.19
    expect(summary.actual.importCost).toBeCloseTo(23.19, 0);
  });

  it('produces the correct net cost after fixed charges and export credit', () => {
    // grossCost ≈ 23.19 + 4.13 = 27.32; netCost ≈ 27.32 − 0.94 = 26.38
    expect(summary.actual.netCost).toBeCloseTo(26.38, 0);
  });

  it('produces correct solar savings over the V1 period', () => {
    // withoutSolar uses day rate on full baseline: ~€30.66 + €4.13 - netCost
    // savings ≈ €8.41 (banded billing gives cheaper actual cost vs day-rate baseline)
    expect(summary.solar.savings).toBeCloseTo(8.41, 0);
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
// Requesting 2025-10-02 to 2025-10-09 but Oct 02 has no seeded summary row.
// ---------------------------------------------------------------------------

describe('range-summary integration — range with one missing day (2025-10-02 to 2025-10-09)', () => {
  const from = '2025-10-02';
  const to   = '2025-10-09';
  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummary(
    v1SummaryRows,       // Oct 02 is not in this array
    allDates,
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
    // First covered day is Oct 03 (index 1 in the series)
    expect(series[1].date).toBe('2025-10-03');
    expect(series[1].billing).not.toBeNull();
  });

  it('excludes the missing day from financial totals', () => {
    // Totals should match the V1 7-day sums exactly (missing day contributes 0)
    expect(summary.totals.importKwh).toBeCloseTo(73.2, 1);
    expect(summary.actual.fixedCharges).toBeCloseTo(4.13, 2);
  });
});
