import type { CalendarMetric } from '../calendar/types';
import type { SunEvents } from '../weather/types';

export type TrendDirection = 'up' | 'down' | 'same';
export type TrendStrength = 'light' | 'medium' | 'strong';
export type TrendTone = 'positive' | 'negative' | 'neutral';
export type TrendPolarity = 'higher-better' | 'lower-better';

export type TrendIndicatorData = {
  direction: TrendDirection;
  strength: TrendStrength;
  tone: TrendTone;
  summary: string;
};

export type FinalCostRow = {
  label: 'Repayment coverage' | 'Total solar value';
  metric: 'prorata_coverage' | 'total_solar_value';
  trendKey: 'prorata_coverage' | 'total_solar_value';
  explanation: string;
  usesFinance: boolean;
};

function getTrendStrength(current: number, previous: number): TrendStrength {
  const diff = current - previous;
  const scale = Math.max(Math.abs(previous), Math.abs(current), 1);
  const relativeDiff = Math.abs(diff) / scale;

  if (relativeDiff >= 0.25) return 'strong';
  if (relativeDiff >= 0.1) return 'medium';
  return 'light';
}

function getTrendTone(direction: TrendDirection, polarity: TrendPolarity): TrendTone {
  if (direction === 'same') return 'neutral';

  if (polarity === 'higher-better') {
    return direction === 'up' ? 'positive' : 'negative';
  }

  return direction === 'down' ? 'positive' : 'negative';
}

export function buildHistoricalTrendIndicator({
  current,
  previous,
  polarity,
  formatter,
  comparisonLabel,
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  polarity: TrendPolarity;
  formatter: (value: number) => string;
  comparisonLabel: string;
}): TrendIndicatorData | undefined {
  if (current == null || previous == null) return undefined;

  const diff = current - previous;
  const scale = Math.max(Math.abs(previous), Math.abs(current), 1);
  const relativeDiff = Math.abs(diff) / scale;

  if (Math.abs(diff) < 0.01 || relativeDiff < 0.02) {
    return {
      direction: 'same',
      strength: relativeDiff < 0.005 ? 'light' : 'medium',
      tone: 'neutral',
      summary: `About the same as ${formatter(previous)} on ${comparisonLabel}`,
    };
  }

  const direction: TrendDirection = diff > 0 ? 'up' : 'down';
  return {
    direction,
    strength: getTrendStrength(current, previous),
    tone: getTrendTone(direction, polarity),
    summary: `${direction === 'up' ? 'Up' : 'Down'} from ${formatter(previous)} on ${comparisonLabel}`,
  };
}

export function buildLiveTrendIndicator({
  current,
  previous,
  polarity,
  formatter,
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  polarity: TrendPolarity;
  formatter: (value: number) => string;
}): TrendIndicatorData | undefined {
  if (current == null || previous == null) return undefined;

  const diff = current - previous;
  const scale = Math.max(Math.abs(previous), Math.abs(current), 1);
  const relativeDiff = Math.abs(diff) / scale;

  if (Math.abs(diff) < 0.01 || relativeDiff < 0.02) {
    return {
      direction: 'same',
      strength: relativeDiff < 0.005 ? 'light' : 'medium',
      tone: 'neutral',
      summary: 'About the same as this time yesterday',
    };
  }

  const direction: TrendDirection = diff > 0 ? 'up' : 'down';
  return {
    direction,
    strength: getTrendStrength(current, previous),
    tone: getTrendTone(direction, polarity),
    summary: `${direction === 'up' ? 'Up' : 'Down'} by ${formatter(Math.abs(diff))} vs this time yesterday`,
  };
}

export function resolveFinalCostRow(repaymentCoverage: { amount: number; percent: number } | null): FinalCostRow {
  if (repaymentCoverage) {
    return {
      label: 'Repayment coverage',
      metric: 'prorata_coverage',
      trendKey: 'prorata_coverage',
      explanation: 'Repayment coverage = total solar value compared with that day’s pro-rata repayment amount.',
      usesFinance: true,
    };
  }

  return {
    label: 'Total solar value',
    metric: 'total_solar_value',
    trendKey: 'total_solar_value',
    explanation: 'Total solar value = onsite solar value + export credit.',
    usesFinance: false,
  };
}

export function getMetricPolarity(metric: CalendarMetric): TrendPolarity {
  switch (metric) {
    case 'import_kwh':
    case 'import_cost':
    case 'net_energy_bill':
      return 'lower-better';
    default:
      return 'higher-better';
  }
}

export function getLiveDayTotalsHeading(sunEvents: SunEvents | null, now: Date): string {
  if (!sunEvents) {
    return 'The day is taking shape';
  }

  const nowMs = now.getTime();
  const sunriseMs = new Date(sunEvents.sunriseUtc).getTime();
  const solarNoonMs = new Date(sunEvents.solarNoonUtc).getTime();
  const sunsetMs = new Date(sunEvents.sunsetUtc).getTime();

  if (nowMs < sunriseMs) {
    return 'The day is waiting for first light';
  }

  if (nowMs >= sunsetMs) {
    return 'Today’s final totals are settling in';
  }

  const solarNoonWindowStart = solarNoonMs - 90 * 60 * 1000;
  const solarNoonWindowEnd = solarNoonMs + 90 * 60 * 1000;

  if (nowMs < solarNoonWindowStart) {
    return 'The solar window is opening up';
  }

  if (nowMs <= solarNoonWindowEnd) {
    return 'The strongest solar hours are in play';
  }

  return 'There’s still daylight left to shape the day';
}
