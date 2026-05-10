import type { RangeSeriesDay } from '../range/types';
import type { RepaymentSchedule } from '../range/recovery';
import {
  CALENDAR_METRICS,
  extractDayValue,
  formatDayValue,
  isLowerBetter,
  type CalendarMetricDescriptor,
} from '../calendar/metrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeaderboardEntry = {
  date: string;
  rawValue: number;
  rank: number;
  formattedValue: string;
  formattedDate: string;
};

export type MetricLeaderboard = {
  metric: CalendarMetricDescriptor;
  entries: LeaderboardEntry[];
  totalDaysWithData: number;
};

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (v % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function formatLeaderboardDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDate();
  const weekday = new Intl.DateTimeFormat('en-IE', { weekday: 'short' }).format(d);
  const month = new Intl.DateTimeFormat('en-IE', { month: 'long' }).format(d);
  const year = d.getFullYear();
  return `${weekday} ${day}${ordinalSuffix(day)} ${month} ${year}`;
}

// ---------------------------------------------------------------------------
// Core ranking
// ---------------------------------------------------------------------------

export function computeLeaderboard(
  series: RangeSeriesDay[],
  schedules: RepaymentSchedule[],
  currency: string,
  topN = 5,
): MetricLeaderboard[] {
  return CALENDAR_METRICS.map((descriptor) => {
    const metric = descriptor.id;
    const lower = isLowerBetter(metric);

    // Extract all valid values.
    const valued: { date: string; rawValue: number }[] = [];
    for (const day of series) {
      const raw = extractDayValue(day, metric, schedules);
      if (raw === null) continue;
      // For higher-is-better metrics exclude non-positive values — a day
      // with zero generation is not a "best generation" day.
      if (!lower && raw <= 0) continue;
      valued.push({ date: day.date, rawValue: raw });
    }

    const totalDaysWithData = valued.length;
    if (totalDaysWithData === 0) {
      return { metric: descriptor, entries: [], totalDaysWithData: 0 };
    }

    // Sort: ascending for lower-better, descending otherwise.
    const sorted = [...valued].sort((a, b) =>
      lower ? a.rawValue - b.rawValue : b.rawValue - a.rawValue,
    );

    // Assign ranks (ties share a rank), collecting whole tied groups until
    // we reach topN entries. All members of the final group are included
    // even if they push the total past topN.
    const entries: LeaderboardEntry[] = [];
    let rank = 1;
    let i = 0;

    while (i < sorted.length && entries.length < topN) {
      const currentValue = sorted[i].rawValue;
      const groupStart = i;

      while (i < sorted.length && sorted[i].rawValue === currentValue) {
        i++;
      }

      for (let j = groupStart; j < i; j++) {
        entries.push({
          date: sorted[j].date,
          rawValue: sorted[j].rawValue,
          rank,
          formattedValue: formatDayValue(sorted[j].rawValue, metric, currency),
          formattedDate: formatLeaderboardDate(sorted[j].date),
        });
      }

      rank++;
    }

    return { metric: descriptor, entries, totalDaysWithData };
  });
}
