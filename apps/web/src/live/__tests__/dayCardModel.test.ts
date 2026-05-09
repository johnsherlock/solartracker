import { describe, expect, it } from 'vitest';
import {
  buildHistoricalTrendIndicator,
  buildLiveTrendIndicator,
  getLiveDayTotalsHeading,
  getMetricPolarity,
  resolveFinalCostRow,
} from '../dayCardModel';

describe('resolveFinalCostRow', () => {
  it('returns repayment coverage row when finance is active', () => {
    const row = resolveFinalCostRow({ amount: 3.84, percent: 196 });
    expect(row.label).toBe('Repayment coverage');
    expect(row.metric).toBe('prorata_coverage');
    expect(row.usesFinance).toBe(true);
  });

  it('returns total solar value row when finance is not active', () => {
    const row = resolveFinalCostRow(null);
    expect(row.label).toBe('Total solar value');
    expect(row.metric).toBe('total_solar_value');
    expect(row.usesFinance).toBe(false);
  });
});

describe('buildHistoricalTrendIndicator', () => {
  it('describes the previous-day value in the tooltip', () => {
    const trend = buildHistoricalTrendIndicator({
      current: 18,
      previous: 15,
      polarity: 'higher-better',
      formatter: (value) => `${value.toFixed(2)} kWh`,
      comparisonLabel: '7 May',
    });

    expect(trend?.summary).toBe('Up from 15.00 kWh on 7 May');
    expect(trend?.tone).toBe('positive');
  });

  it('inverts tone for lower-is-better metrics when values rise', () => {
    const trend = buildHistoricalTrendIndicator({
      current: 4.2,
      previous: 3.1,
      polarity: 'lower-better',
      formatter: (value) => `€${value.toFixed(2)}`,
      comparisonLabel: '7 May',
    });

    expect(trend?.direction).toBe('up');
    expect(trend?.tone).toBe('negative');
  });
});

describe('buildLiveTrendIndicator', () => {
  it('describes the delta vs this time yesterday', () => {
    const trend = buildLiveTrendIndicator({
      current: 2.10,
      previous: 1.55,
      polarity: 'higher-better',
      formatter: (value) => `€${value.toFixed(2)}`,
    });

    expect(trend?.summary).toBe('Up by €0.55 vs this time yesterday');
  });

  it('returns neutral wording for near-identical values', () => {
    const trend = buildLiveTrendIndicator({
      current: 10.001,
      previous: 10,
      polarity: 'higher-better',
      formatter: (value) => `${value.toFixed(2)} kWh`,
    });

    expect(trend?.direction).toBe('same');
    expect(trend?.tone).toBe('neutral');
    expect(trend?.summary).toBe('About the same as this time yesterday');
  });
});

describe('getMetricPolarity', () => {
  it('marks import and net bill metrics as lower-is-better', () => {
    expect(getMetricPolarity('import_cost')).toBe('lower-better');
    expect(getMetricPolarity('import_kwh')).toBe('lower-better');
    expect(getMetricPolarity('net_energy_bill')).toBe('lower-better');
  });
});

describe('getLiveDayTotalsHeading', () => {
  const sunEvents = {
    localDate: '2026-05-09',
    sunriseUtc: '2026-05-09T05:30:00.000Z',
    solarNoonUtc: '2026-05-09T12:30:00.000Z',
    sunsetUtc: '2026-05-09T19:30:00.000Z',
    daylightSeconds: 50400,
  };

  it('uses the fallback heading when sun events are unavailable', () => {
    expect(getLiveDayTotalsHeading(null, new Date('2026-05-09T09:00:00.000Z'))).toBe(
      'The day is taking shape',
    );
  });

  it('returns the pre-sunrise heading before sunrise', () => {
    expect(getLiveDayTotalsHeading(sunEvents, new Date('2026-05-09T05:00:00.000Z'))).toBe(
      'The day is waiting for first light',
    );
  });

  it('returns the morning heading after sunrise', () => {
    expect(getLiveDayTotalsHeading(sunEvents, new Date('2026-05-09T08:00:00.000Z'))).toBe(
      'The solar window is opening up',
    );
  });

  it('returns the solar-noon heading around midday', () => {
    expect(getLiveDayTotalsHeading(sunEvents, new Date('2026-05-09T12:15:00.000Z'))).toBe(
      'The strongest solar hours are in play',
    );
  });

  it('returns the afternoon heading before sunset', () => {
    expect(getLiveDayTotalsHeading(sunEvents, new Date('2026-05-09T15:30:00.000Z'))).toBe(
      'There’s still daylight left to shape the day',
    );
  });

  it('returns the after-sunset heading once the solar window is over', () => {
    expect(getLiveDayTotalsHeading(sunEvents, new Date('2026-05-09T20:00:00.000Z'))).toBe(
      'Today’s final totals are settling in',
    );
  });
});
