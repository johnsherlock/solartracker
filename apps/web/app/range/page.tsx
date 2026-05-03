import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadDailyPricedRollupsForRange,
  loadEarliestIntervalDate,
} from '@/src/range/loader';
import { allDatesInRange, computeRangeSummaryFromRollups } from '@/src/range/billing';
import type { RangeSummaryPayload } from '@/src/range/types';
import {
  computeAllTimeSavings,
  type RangeFinanceContext,
} from '@/src/range/recovery';
import { RangeHistoryScreen } from './RangeHistoryScreen';
import { redirect } from 'next/navigation';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { loadStaleTariffWarning, type StaleTariffWarning } from '@/src/tariffs/stale-check';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Range History — PV Manager',
  description: 'Energy, solar, and financial performance over time',
};

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function offsetDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type PageProps = {
  searchParams: Promise<{ mode?: string; from?: string; to?: string }>;
};

export default async function RangePage({ searchParams }: PageProps) {
  const { mode, from: initialFrom, to: initialTo } = await searchParams;

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/connect-provider');
  const installationContext = await loadRangeInstallationContext(installationId);
  const timezone = installationContext?.timezone ?? 'Europe/Dublin';
  const currency = installationContext?.currency ?? 'EUR';
  const today = getTodayLocalDate(timezone);

  const earliestDate = await loadEarliestIntervalDate(installationId, timezone);

  // For "All" mode, load from the earliest known summary date.
  // When a specific from date is in the URL that predates the default window,
  // extend the window to cover it so historical range selections work.
  // Otherwise fall back to the default 365-day window.
  const defaultWindowStart = offsetDays(today, -364);
  const windowStart =
    mode === 'all' && earliestDate ? earliestDate
    : initialFrom && initialFrom < defaultWindowStart ? initialFrom
    : defaultWindowStart;
  const windowEnd = today;

  // Load all-time rows only when: (a) finance context exists, (b) there are summaries,
  // and (c) the current window doesn't already cover all history (mode=all).
  const hasFinanceContext =
    installationContext?.totalSystemInvestment != null &&
    installationContext?.earliestAdditionDate != null;
  const needsAllTimeLoad = hasFinanceContext && earliestDate != null && earliestDate !== windowStart;

  // Load stale-tariff warning with a silent fallback so a failure here doesn't prevent
  // the page from rendering its data or its error state.
  const staleTariffWarning = await loadStaleTariffWarning(installationId, timezone).catch(
    (): StaleTariffWarning => ({ stale: false }),
  );

  try {
    const [tariffVersions, rollups, allTimeRollups] = await Promise.all([
      loadTariffVersionsForInstallation(installationId),
      loadDailyPricedRollupsForRange(installationId, windowStart, windowEnd),
      needsAllTimeLoad
        ? loadDailyPricedRollupsForRange(installationId, earliestDate!, today)
        : Promise.resolve(null),
    ]);

    const allDates = allDatesInRange(windowStart, windowEnd);
    const { summary, series, health } = computeRangeSummaryFromRollups(
      rollups,
      allDates,
      timezone,
      tariffVersions,
    );

    let financeContext: RangeFinanceContext | null = null;
    if (hasFinanceContext) {
      let allTimeSavings = 0;
      let allTimeCoveredDays = 0;

      if (earliestDate != null) {
        const rollupsForAllTime = allTimeRollups ?? rollups;
        const allTimeDates = allDatesInRange(earliestDate, today);
        const { series: allTimeSeries } = computeRangeSummaryFromRollups(
          rollupsForAllTime,
          allTimeDates,
          timezone,
          tariffVersions,
        );
        ({ savings: allTimeSavings, coveredDays: allTimeCoveredDays } =
          computeAllTimeSavings(allTimeSeries));
      }

      financeContext = {
        totalSystemInvestment: installationContext!.totalSystemInvestment!,
        earliestAdditionDate: installationContext!.earliestAdditionDate!,
        allTimeSavings,
        allTimeCoveredDays,
        repaymentSchedules: installationContext!.repaymentSchedules,
      };
    }

    const payload: RangeSummaryPayload = {
      meta: {
        from: windowStart,
        to: windowEnd,
        timezone,
        currency,
        generatedAt: new Date().toISOString(),
        earliestDate,
      },
      summary,
      series,
      health,
    };

    return (
      <RangeHistoryScreen
        payload={payload}
        today={today}
        financeContext={financeContext}
        initialMode={mode ?? null}
        initialFrom={initialFrom ?? null}
        initialTo={initialTo ?? null}
        error={false}
        staleTariffWarning={staleTariffWarning}
      />
    );
  } catch (err) {
    console.error('[RangePage] Failed to load range data:', err);
    return (
      <RangeHistoryScreen
        payload={null}
        today={today}
        financeContext={null}
        initialMode={mode ?? null}
        initialFrom={initialFrom ?? null}
        initialTo={initialTo ?? null}
        error={true}
        staleTariffWarning={staleTariffWarning}
      />
    );
  }
}
