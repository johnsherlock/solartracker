import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadFixedChargeVersionsForInstallation,
  loadDailySummaryRowsForRange,
  loadEarliestSummaryDate,
} from '@/src/range/loader';
import { allDatesInRange, computeRangeSummary } from '@/src/range/billing';
import type { RangeSummaryPayload } from '@/src/range/types';
import {
  computeAllTimeSavings,
  type RangeFinanceContext,
} from '@/src/range/recovery';
import { RangeHistoryScreen } from './RangeHistoryScreen';
import { redirect } from 'next/navigation';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';

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

  const earliestDate = await loadEarliestSummaryDate(installationId);

  // For "All" mode, load from the earliest known summary date.
  // Otherwise fall back to the default 365-day window.
  const windowStart =
    mode === 'all' && earliestDate ? earliestDate : offsetDays(today, -364);
  const windowEnd = today;

  const needsAllTimeLoad =
    installationContext?.totalSystemInvestment != null && earliestDate != null;

  try {
    const [tariffVersions, fixedCharges, summaryRows, allTimeRows] = await Promise.all([
      loadTariffVersionsForInstallation(installationId),
      loadFixedChargeVersionsForInstallation(installationId),
      loadDailySummaryRowsForRange(installationId, windowStart, windowEnd),
      needsAllTimeLoad && earliestDate !== windowStart
        ? loadDailySummaryRowsForRange(installationId, earliestDate!, today)
        : Promise.resolve(null),
    ]);

    const allDates = allDatesInRange(windowStart, windowEnd);
    const { summary, series, health } = computeRangeSummary(
      summaryRows,
      allDates,
      tariffVersions,
      fixedCharges,
    );

    let financeContext: RangeFinanceContext | null = null;
    if (
      installationContext?.totalSystemInvestment != null &&
      installationContext.earliestAdditionDate != null &&
      earliestDate != null
    ) {
      // Use windowed rows when they already cover all history (mode=all), else use the dedicated all-time load
      const rowsForAllTime = allTimeRows ?? summaryRows;
      const allTimeDates = allDatesInRange(earliestDate, today);
      const { series: allTimeSeries } = computeRangeSummary(
        rowsForAllTime,
        allTimeDates,
        tariffVersions,
        fixedCharges,
      );
      const { savings, coveredDays } = computeAllTimeSavings(allTimeSeries);

      financeContext = {
        totalSystemInvestment: installationContext.totalSystemInvestment,
        earliestAdditionDate: installationContext.earliestAdditionDate,
        allTimeSavings: savings,
        allTimeCoveredDays: coveredDays,
        activeMonthlyRepayment: installationContext.activeMonthlyRepayment,
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
      />
    );
  }
}
