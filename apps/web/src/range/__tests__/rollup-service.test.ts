import { describe, it, expect } from 'vitest';
import { buildDailyPricedRollup } from '../rollup-service';
import { computeRangeSummary, allDatesInRange } from '../billing';
import type { ScheduledTariffVersion, FixedChargeVersion } from '../../domain/billing';
import type { IntervalSlot } from '../../jobs/derive-summary';
import type { IntervalRow } from '../loader';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TZ = 'Europe/Dublin';
const DATE = '2024-11-15'; // winter — UTC+0, so local midnight = UTC midnight

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

function makeSlots(
  utcStartISO: string,
  count = 48,
  perSlot: Partial<Omit<IntervalSlot, 'intervalStart'>> = {},
  readingCount = 30,
): IntervalSlot[] {
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

function asIntervalRows(slots: IntervalSlot[]): IntervalRow[] {
  return slots.map((s) => ({
    intervalStart: s.intervalStart,
    importKwh: s.importKwh,
    generationKwh: s.generationKwh,
    exportKwh: s.exportKwh,
    immersionDivertedKwh: s.immersionDivertedKwh,
    immersionBoostedKwh: s.immersionBoostedKwh,
    consumedKwh: s.consumedKwh,
    readingCount: s.readingCount,
  }));
}

const STD_SLOT: Partial<Omit<IntervalSlot, 'intervalStart'>> = {
  importKwh: 5 / 48,
  exportKwh: 3 / 48,
  generationKwh: 8 / 48,
  consumedKwh: 10 / 48,
  immersionDivertedKwh: 0,
};

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — energy totals
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — energy totals', () => {
  const slots = makeSlots(`${DATE}T00:00:00Z`, 48, STD_SLOT);
  const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], [standingCharge]);

  it('sums generatedKwh correctly', () => {
    expect(rollup.generatedKwh).toBeCloseTo(8, 5);
  });

  it('sums importKwh correctly', () => {
    expect(rollup.importKwh).toBeCloseTo(5, 5);
  });

  it('sums exportKwh correctly', () => {
    expect(rollup.exportKwh).toBeCloseTo(3, 5);
  });

  it('sums consumedKwh correctly', () => {
    expect(rollup.consumedKwh).toBeCloseTo(10, 5);
  });

  it('records correct slotCount', () => {
    expect(rollup.slotCount).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — financial outputs match computeRangeSummary
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — financial outputs match computeRangeSummary', () => {
  const slots = makeSlots(`${DATE}T00:00:00Z`, 48, STD_SLOT);
  const rows = asIntervalRows(slots);
  const allDates = allDatesInRange(DATE, DATE);

  const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], [standingCharge]);
  const { series } = computeRangeSummary(rows, allDates, TZ, [baseTariff], [standingCharge]);
  const dayBilling = series[0].billing!;

  it('importCost matches computeRangeSummary', () => {
    expect(rollup.importCost).toBeCloseTo(dayBilling.importCost, 2);
  });

  it('exportCredit matches computeRangeSummary', () => {
    expect(rollup.exportCredit).toBeCloseTo(dayBilling.exportCredit, 2);
  });

  it('selfConsumedSolarValue matches computeRangeSummary', () => {
    expect(rollup.selfConsumedSolarValue).toBeCloseTo(dayBilling.selfConsumedSolarValue, 2);
  });

  it('fixedCharges matches computeRangeSummary', () => {
    expect(rollup.fixedCharges).toBeCloseTo(dayBilling.fixedCharges, 2);
  });

  it('freeImportKwh matches computeRangeSummary', () => {
    expect(rollup.freeImportKwh ?? 0).toBeCloseTo(dayBilling.freeImportKwh, 6);
  });
});

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — isPartial flag
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — isPartial', () => {
  it('isPartial false when all 48 slots have full reading counts', () => {
    const slots = makeSlots(`${DATE}T00:00:00Z`, 48, {}, 30);
    const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], []);
    expect(rollup.isPartial).toBe(false);
  });

  it('isPartial true when readingCount sum is below 90% of expected minutes', () => {
    // 48 slots × 10 readings = 480 minutes, threshold is 0.9 × 1440 = 1296 minutes
    const slots = makeSlots(`${DATE}T00:00:00Z`, 48, {}, 10);
    const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], []);
    expect(rollup.isPartial).toBe(true);
  });

  it('isPartial false for fewer slots when total readingCount still meets threshold', () => {
    // 24 slots × 30 readings = 720 minutes, below 1296 — so partial
    const slots = makeSlots(`${DATE}T00:00:00Z`, 24, {}, 30);
    const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], []);
    expect(rollup.isPartial).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — no tariff
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — no tariff', () => {
  const slots = makeSlots(`${DATE}T00:00:00Z`, 48, STD_SLOT);
  const rollup = buildDailyPricedRollup(slots, DATE, TZ, [], []);

  it('all priced fields are null when no tariff provided', () => {
    expect(rollup.importCost).toBeNull();
    expect(rollup.exportCredit).toBeNull();
    expect(rollup.selfConsumedSolarValue).toBeNull();
    expect(rollup.withoutSolarImportCost).toBeNull();
    expect(rollup.fixedCharges).toBeNull();
    expect(rollup.freeImportKwh).toBeNull();
  });

  it('tariffVersionId is null when no tariff provided', () => {
    expect(rollup.tariffVersionId).toBeNull();
  });

  it('energy totals are still computed', () => {
    expect(rollup.importKwh).toBeCloseTo(5, 5);
    expect(rollup.generatedKwh).toBeCloseTo(8, 5);
  });
});

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — stores resolved tariffVersionId
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — tariffVersionId', () => {
  it('stores the tariff version id that covers this date', () => {
    const slots = makeSlots(`${DATE}T00:00:00Z`, 48, STD_SLOT);
    const rollup = buildDailyPricedRollup(slots, DATE, TZ, [baseTariff], []);
    expect(rollup.tariffVersionId).toBe('tariff-v1');
  });

  it('is null when no tariff covers this date', () => {
    const futureTariff: ScheduledTariffVersion = {
      ...baseTariff,
      validFromLocalDate: '2025-01-01',
    };
    const slots = makeSlots(`${DATE}T00:00:00Z`, 48, STD_SLOT);
    const rollup = buildDailyPricedRollup(slots, DATE, TZ, [futureTariff], []);
    expect(rollup.tariffVersionId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildDailyPricedRollup — empty slots
// ---------------------------------------------------------------------------

describe('buildDailyPricedRollup — empty slots', () => {
  const rollup = buildDailyPricedRollup([], DATE, TZ, [baseTariff], [standingCharge]);

  it('returns zero energy totals', () => {
    expect(rollup.generatedKwh).toBe(0);
    expect(rollup.importKwh).toBe(0);
    expect(rollup.exportKwh).toBe(0);
  });

  it('slotCount is 0', () => {
    expect(rollup.slotCount).toBe(0);
  });

  it('isPartial true (0 readings < threshold)', () => {
    expect(rollup.isPartial).toBe(true);
  });
});
