import { describe, it, expect } from 'vitest';
import type { MinuteReading, PeriodReading, DayDetailResponse } from '../types';
import type { TariffContext } from '../loader';
import {
  deriveScreenState,
  getMinutesStale,
  getLastReadingLocalTime,
  getCurrentMetrics,
  computeFinancialEstimate,
  minuteDataToFiveMinPoints,
  minuteDataToChartPoints,
  periodDataToChartPoints,
  periodDataToCostPoints,
} from '../loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinute(hour: number, minute: number, overrides: Partial<MinuteReading> = {}): MinuteReading {
  return {
    hour,
    minute,
    generatedKwh: 0,
    consumedKwh: 0,
    importKwh: 0,
    exportKwh: 0,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    selfConsumptionRatio: 0,
    ...overrides,
  };
}

function makePeriod(hour: number, minute: 0 | 30, overrides: Partial<PeriodReading> = {}): PeriodReading {
  return {
    hour,
    minute,
    generatedKwh: 0,
    consumedKwh: 0,
    importKwh: 0,
    exportKwh: 0,
    immersionDivertedKwh: 0,
    immersionBoostedKwh: 0,
    selfConsumptionRatio: 0,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<DayDetailResponse['health']> = {}): DayDetailResponse['health'] {
  return {
    recordCount: 0,
    isPartialDay: false,
    completenessRatio: 0,
    expectedMinutes: 1440,
    coveredMinutes: 1440,
    uptimePercent: 100,
    hasSuspiciousReadings: false,
    incidents: [],
    primaryIncident: null,
    fetchedAt: '2024-06-01T10:00:00Z',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DayDetailResponse['summary']> = {}): DayDetailResponse['summary'] {
  return {
    totalImportKwh: 0,
    totalExportKwh: 0,
    totalGeneratedKwh: 0,
    totalConsumedKwh: 0,
    totalImmersionDivertedKwh: 0,
    totalImmersionBoostedKwh: 0,
    selfConsumptionRatio: 0,
    gridDependenceRatio: 0,
    ...overrides,
  };
}

const baseTariff: TariffContext = {
  versionId: 'tariff-v1',
  supplierName: 'Test',
  planName: 'Standard',
  dayRate: 0.40,
  nightRate: null,
  peakRate: null,
  exportRate: 0.21,
  vatRate: 0.09,
  discountRuleType: null,
  discountValue: null,
  nightStartLocalTime: null,
  nightEndLocalTime: null,
  peakStartLocalTime: null,
  peakEndLocalTime: null,
};

// ---------------------------------------------------------------------------
// deriveScreenState
// ---------------------------------------------------------------------------

describe('deriveScreenState', () => {
  it('returns disconnected when no minute data', () => {
    expect(deriveScreenState(makeHealth(), [], new Date())).toBe('disconnected');
  });

  it('returns warning when health has suspicious readings', () => {
    const now = new Date('2024-06-01T10:00:00');
    const data = [makeMinute(9, 59)];
    expect(deriveScreenState(makeHealth({ hasSuspiciousReadings: true }), data, now)).toBe('warning');
  });

  it('returns healthy when last reading is within 30 min', () => {
    const now = new Date('2024-06-01T10:15:00');
    const data = [makeMinute(10, 10)];
    expect(deriveScreenState(makeHealth(), data, now)).toBe('healthy');
  });

  it('returns stale when last reading is older than 30 min', () => {
    const now = new Date('2024-06-01T10:45:00');
    const data = [makeMinute(10, 10)];
    expect(deriveScreenState(makeHealth(), data, now)).toBe('stale');
  });

  it('returns healthy when exactly 30 min stale', () => {
    const now = new Date('2024-06-01T10:40:00');
    const data = [makeMinute(10, 10)];
    expect(deriveScreenState(makeHealth(), data, now)).toBe('healthy');
  });

  it('uses installation timezone when computing staleness', () => {
    const now = new Date('2024-06-01T09:45:00Z');
    const data = [makeMinute(10, 10)];
    expect(deriveScreenState(makeHealth(), data, now, 'Europe/Dublin')).toBe('stale');
  });
});

// ---------------------------------------------------------------------------
// getMinutesStale
// ---------------------------------------------------------------------------

describe('getMinutesStale', () => {
  it('returns null for empty data', () => {
    expect(getMinutesStale([], new Date())).toBeNull();
  });

  it('returns correct staleness in minutes', () => {
    const now = new Date('2024-06-01T11:20:00');
    const data = [makeMinute(11, 0)];
    expect(getMinutesStale(data, now)).toBe(20);
  });

  it('returns 0 when reading is current', () => {
    const now = new Date('2024-06-01T11:05:00');
    const data = [makeMinute(11, 5)];
    expect(getMinutesStale(data, now)).toBe(0);
  });

  it('computes stale minutes in installation timezone', () => {
    const now = new Date('2024-06-01T09:45:00Z');
    const data = [makeMinute(10, 10)];
    expect(getMinutesStale(data, now, 'Europe/Dublin')).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// getLastReadingLocalTime
// ---------------------------------------------------------------------------

describe('getLastReadingLocalTime', () => {
  it('returns null for empty data', () => {
    expect(getLastReadingLocalTime([])).toBeNull();
  });

  it('formats time with zero-padded hour and minute', () => {
    const data = [makeMinute(9, 5)];
    expect(getLastReadingLocalTime(data)).toBe('09:05');
  });

  it('returns the last reading time (not first)', () => {
    const data = [makeMinute(9, 0), makeMinute(9, 1), makeMinute(9, 2)];
    expect(getLastReadingLocalTime(data)).toBe('09:02');
  });
});

// ---------------------------------------------------------------------------
// getCurrentMetrics
// ---------------------------------------------------------------------------

describe('getCurrentMetrics', () => {
  it('returns null for empty data', () => {
    expect(getCurrentMetrics([])).toBeNull();
  });

  it('converts kWh/min to kW by multiplying by 60', () => {
    const data = [
      makeMinute(10, 0, {
        generatedKwh: 0.05,  // 3 kW
        consumedKwh: 0.04,   // 2.4 kW
        importKwh: 0,
        exportKwh: 0.01,     // 0.6 kW
      }),
    ];
    const metrics = getCurrentMetrics(data);
    expect(metrics).not.toBeNull();
    expect(metrics!.generatedKw).toBe(3);
    expect(metrics!.consumedKw).toBe(2.4);
    expect(metrics!.exportKw).toBe(0.6);
    expect(metrics!.immersionKw).toBe(0);
  });

  it('computes solarShare correctly', () => {
    const data = [
      makeMinute(10, 0, {
        generatedKwh: 0.05,  // 3 kW generated
        consumedKwh: 0.04,   // 2.4 kW consumed
        importKwh: 0,
        exportKwh: 0.01,     // 0.6 kW exported → 2.4 kW solar consumed
      }),
    ];
    const metrics = getCurrentMetrics(data);
    // solarConsumed = 3 - 0.6 = 2.4 kW; solarShare = 2.4/2.4 = 100%
    expect(metrics!.solarShare).toBe(100);
    expect(metrics!.gridShare).toBe(0);
  });

  it('returns solarShare 0 when no consumption', () => {
    const data = [makeMinute(10, 0, { generatedKwh: 0.05, consumedKwh: 0 })];
    const metrics = getCurrentMetrics(data);
    expect(metrics!.solarShare).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeFinancialEstimate
// ---------------------------------------------------------------------------

describe('computeFinancialEstimate', () => {
  it('computes import cost with VAT', () => {
    const summary = makeSummary({ totalImportKwh: 5, totalExportKwh: 2, totalGeneratedKwh: 10 });
    const estimate = computeFinancialEstimate(summary, baseTariff);
    // importCost = 5 * 0.40 * 1.09 = 2.18
    expect(estimate.importCost).toBe(2.18);
  });

  it('computes export credit without VAT', () => {
    const summary = makeSummary({ totalImportKwh: 5, totalExportKwh: 2, totalGeneratedKwh: 10 });
    const estimate = computeFinancialEstimate(summary, baseTariff);
    // exportCredit = 2 * 0.21 = 0.42
    expect(estimate.exportCredit).toBe(0.42);
  });

  it('computes solar savings as avoided import', () => {
    const summary = makeSummary({ totalGeneratedKwh: 10, totalExportKwh: 2, totalImportKwh: 0 });
    const estimate = computeFinancialEstimate(summary, baseTariff);
    // solarConsumed = 10 - 2 = 8 kWh; solarSavings = 8 * 0.40 * 1.09 = 3.49 (rounded)
    expect(estimate.solarSavings).toBe(3.49);
  });

  it('returns note: simplified-daily-rate', () => {
    const estimate = computeFinancialEstimate(makeSummary(), baseTariff);
    expect(estimate.note).toBe('simplified-daily-rate');
  });

  it('handles null export rate', () => {
    const summary = makeSummary({ totalGeneratedKwh: 5, totalExportKwh: 2 });
    const tariffNoExport: TariffContext = { ...baseTariff, exportRate: null };
    const estimate = computeFinancialEstimate(summary, tariffNoExport);
    expect(estimate.exportCredit).toBe(0);
  });

  it('returns a negative net bill impact when export credit exceeds import cost', () => {
    const summary = makeSummary({ totalImportKwh: 1, totalExportKwh: 10, totalGeneratedKwh: 10 });
    const estimate = computeFinancialEstimate(summary, baseTariff);
    expect(estimate.netBillImpact).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// minuteDataToFiveMinPoints
// ---------------------------------------------------------------------------

describe('minuteDataToFiveMinPoints', () => {
  it('returns empty array for no data', () => {
    expect(minuteDataToFiveMinPoints([])).toEqual([]);
  });

  it('aggregates minutes into 5-min buckets', () => {
    const data = [
      makeMinute(10, 0, { generatedKwh: 0.05, consumedKwh: 0.04, importKwh: 0, exportKwh: 0.01 }),
      makeMinute(10, 1, { generatedKwh: 0.05, consumedKwh: 0.04, importKwh: 0, exportKwh: 0.01 }),
      makeMinute(10, 2, { generatedKwh: 0.05, consumedKwh: 0.04, importKwh: 0, exportKwh: 0.01 }),
    ];
    const points = minuteDataToFiveMinPoints(data);
    expect(points).toHaveLength(1);
    expect(points[0].time).toBe('10:00');
    // avg kWh/min = 0.05, kW = 0.05 * 60 = 3
    expect(points[0].generation).toBe(3);
  });

  it('creates separate buckets for different 5-min windows', () => {
    const data = [
      makeMinute(10, 0, { generatedKwh: 0.05 }),
      makeMinute(10, 5, { generatedKwh: 0.03 }),
    ];
    const points = minuteDataToFiveMinPoints(data);
    expect(points).toHaveLength(2);
    expect(points[0].time).toBe('10:00');
    expect(points[1].time).toBe('10:05');
  });

  it('sorts points chronologically', () => {
    const data = [
      makeMinute(10, 10),
      makeMinute(10, 0),
      makeMinute(10, 5),
    ];
    const points = minuteDataToFiveMinPoints(data);
    const times = points.map((p) => p.time);
    expect(times).toEqual([...times].sort());
  });
});

// ---------------------------------------------------------------------------
// minuteDataToChartPoints
// ---------------------------------------------------------------------------

describe('minuteDataToChartPoints', () => {
  it('returns empty array for no data', () => {
    expect(minuteDataToChartPoints([])).toEqual([]);
  });

  it('converts each minute record directly to a chart point', () => {
    const points = minuteDataToChartPoints([
      makeMinute(10, 7, { generatedKwh: 0.05, consumedKwh: 0.04, importKwh: 0.01, exportKwh: 0 }),
    ]);

    expect(points).toEqual([
      {
        time: '10:07',
        generation: 3,
        consumption: 2.4,
        import: 0.6,
        export: 0,
        immersion: 0,
        intervalHours: 1 / 60,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// periodDataToChartPoints
// ---------------------------------------------------------------------------

describe('periodDataToChartPoints', () => {
  it('returns empty array for no data', () => {
    expect(periodDataToChartPoints([], 30)).toEqual([]);
  });

  it('converts half-hour kWh to kW (factor 2)', () => {
    const periods = [
      makePeriod(10, 0, { generatedKwh: 1.5, consumedKwh: 1.0, importKwh: 0.2, exportKwh: 0.7 }),
    ];
    const points = periodDataToChartPoints(periods, 30);
    expect(points[0].generation).toBe(3);   // 1.5 * 2
    expect(points[0].consumption).toBe(2);  // 1.0 * 2
    expect(points[0].import).toBe(0.4);     // 0.2 * 2
    expect(points[0].export).toBe(1.4);     // 0.7 * 2
    expect(points[0].intervalHours).toBe(0.5);
  });

  it('converts hourly kWh to kW (factor 1)', () => {
    const periods = [
      makePeriod(10, 0, { generatedKwh: 3.0, consumedKwh: 2.5, importKwh: 0, exportKwh: 0.5 }),
    ];
    const points = periodDataToChartPoints(periods, 60);
    expect(points[0].generation).toBe(3);
    expect(points[0].consumption).toBe(2.5);
    expect(points[0].export).toBe(0.5);
    expect(points[0].intervalHours).toBe(1);
  });

  it('formats time with zero-padding', () => {
    const periods = [makePeriod(9, 0)];
    const points = periodDataToChartPoints(periods, 30);
    expect(points[0].time).toBe('09:00');
  });
});

// ---------------------------------------------------------------------------
// periodDataToCostPoints
// ---------------------------------------------------------------------------

describe('periodDataToCostPoints', () => {
  it('builds half-hour import, savings, and export values in euro', () => {
    const periods = [
      makePeriod(10, 0, {
        generatedKwh: 1.5,
        consumedKwh: 2,
        importKwh: 0.5,
        exportKwh: 0.2,
        immersionDivertedKwh: 0.1,
      }),
    ];

    const points = periodDataToCostPoints(periods, '2026-03-30', baseTariff);

    expect(points).toEqual([
      {
        time: '10:00',
        importCost: 0.22,
        savings: 0.52,
        exportCredit: 0.04,
      },
    ]);
  });

  it('works with time-of-use windows for half-hour intervals', () => {
    const touTariff: TariffContext = {
      ...baseTariff,
      nightRate: 0.2,
      peakRate: 0.6,
      nightStartLocalTime: '23:00',
      nightEndLocalTime: '08:00',
      peakStartLocalTime: '17:00',
      peakEndLocalTime: '19:00',
    };

    const periods = [
      makePeriod(7, 30, { importKwh: 1 }),
      makePeriod(17, 0, { importKwh: 1 }),
      makePeriod(12, 0, { importKwh: 1 }),
    ];

    const points = periodDataToCostPoints(periods, '2026-03-30', touTariff);

    expect(points.map((point) => point.importCost)).toEqual([0.22, 0.65, 0.44]);
  });
});
