import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadDailyPricedRollupsForRange,
  loadEarliestIntervalDate,
} from '@/src/range/loader';
import { allDatesInRange, computeRangeSummaryFromRollups } from '@/src/range/billing';
import type { RangeSummaryPayload } from '@/src/range/types';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { redirect } from 'next/navigation';
import { CalendarScreen } from './CalendarScreen';
import { isCalendarMetric, type CalendarMetric } from '@/src/calendar/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Calendar — PV Manager',
  description: 'Year-at-a-glance daily energy history',
};

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type PageProps = {
  searchParams: Promise<{ year?: string; metric?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const { year: yearParam, metric: metricParam } = await searchParams;

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/connect-provider');

  const installationContext = await loadRangeInstallationContext(installationId);
  if (!installationContext) redirect('/connect-provider');

  const timezone = installationContext.timezone ?? 'Europe/Dublin';
  const currency = installationContext.currency ?? 'EUR';
  const today = getTodayLocalDate(timezone);
  const currentYear = parseInt(today.slice(0, 4), 10);

  const requestedYear = yearParam ? parseInt(yearParam, 10) : currentYear;
  const year = Number.isNaN(requestedYear) ? currentYear : Math.min(requestedYear, currentYear);
  const initialMetric: CalendarMetric =
    metricParam && isCalendarMetric(metricParam) ? metricParam : 'generation_kwh';

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  try {
    const [tariffVersions, rollups, earliestDate] = await Promise.all([
      loadTariffVersionsForInstallation(installationId),
      loadDailyPricedRollupsForRange(installationId, from, to),
      loadEarliestIntervalDate(installationId, timezone),
    ]);

    const allDates = allDatesInRange(from, to);
    const { summary, series, health } = computeRangeSummaryFromRollups(
      rollups,
      allDates,
      timezone,
      tariffVersions,
    );

    const payload: RangeSummaryPayload = {
      meta: { from, to, timezone, currency, generatedAt: new Date().toISOString(), earliestDate },
      summary,
      series,
      health,
    };

    return (
      <CalendarScreen
        payload={payload}
        year={year}
        initialMetric={initialMetric}
        today={today}
        earliestDate={earliestDate}
        repaymentSchedules={installationContext.repaymentSchedules}
        currency={currency}
      />
    );
  } catch (err) {
    console.error('[CalendarPage] Failed to load year data:', err);
    return (
      <CalendarScreen
        payload={null}
        year={year}
        initialMetric={initialMetric}
        today={today}
        earliestDate={null}
        repaymentSchedules={installationContext.repaymentSchedules}
        currency={currency}
      />
    );
  }
}
