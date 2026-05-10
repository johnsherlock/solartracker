import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadDailyPricedRollupsForRange,
  loadEarliestIntervalDate,
} from '../range/loader';
import { allDatesInRange, computeRangeSummaryFromRollups } from '../range/billing';
import type { RangeSeriesDay } from '../range/types';
import type { RepaymentSchedule } from '../range/recovery';

export type LeaderboardContext = {
  currency: string;
  timezone: string;
  repaymentSchedules: RepaymentSchedule[];
  series: RangeSeriesDay[];
};

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function loadLeaderboardContext(
  installationId: string,
): Promise<LeaderboardContext | null> {
  const installationContext = await loadRangeInstallationContext(installationId);
  if (!installationContext) return null;

  const timezone = installationContext.timezone ?? 'Europe/Dublin';
  const currency = installationContext.currency ?? 'EUR';
  const today = getTodayLocalDate(timezone);
  const earliestDate = await loadEarliestIntervalDate(installationId, timezone);

  if (!earliestDate) {
    return {
      currency,
      timezone,
      repaymentSchedules: installationContext.repaymentSchedules,
      series: [],
    };
  }

  const from = earliestDate;
  const to = today;

  const [tariffVersions, rollups] = await Promise.all([
    loadTariffVersionsForInstallation(installationId),
    loadDailyPricedRollupsForRange(installationId, from, to),
  ]);

  const allDates = allDatesInRange(from, to);
  const { series } = computeRangeSummaryFromRollups(rollups, allDates, timezone, tariffVersions);

  return {
    currency,
    timezone,
    repaymentSchedules: installationContext.repaymentSchedules,
    series,
  };
}
