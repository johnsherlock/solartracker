import { describe, expect, it } from 'vitest';
import {
  calculateBillingPeriod,
  calculateWithoutSolarImportKwh,
  getTariffRateForInterval,
  resolveTariffVersion,
  type FixedChargeVersion,
  type IntervalReading,
  type TariffVersion,
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
