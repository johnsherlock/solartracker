import { redirect } from 'next/navigation';
import { fetchMinuteData } from '@/src/providers/v1/adapter';
import { buildDayDetail } from '@/src/live/normalizer';
import {
  loadInstallationContext,
  loadTariffContext,
  computeFinancialEstimate,
  getLastReadingLocalTime,
  minuteDataToChartPoints,
  periodDataToChartPoints,
  periodDataToCostPoints,
} from '@/src/live/loader';
import { HistoricalDayScreen } from './HistoricalDayScreen';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDisplayDate(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return {
    title: `${date} — PV Manager`,
    description: `Historical solar system data for ${date}`,
  };
}

export default async function HistoricalDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const now = new Date();
  const { date } = await params;

  // Validate format and calendar legitimacy (e.g. reject 2024-13-01 or 2024-00-10)
  if (!DATE_PATTERN.test(date) || isNaN(new Date(`${date}T12:00:00`).getTime())) {
    redirect('/live');
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/connect-provider');
  const installationContext = await loadInstallationContext(installationId);
  const effectiveTimezone = installationContext?.timezone ?? 'Europe/Dublin';
  const today = getTodayLocalDate(effectiveTimezone);

  // Redirect today or future to live
  if (date >= today) {
    redirect('/live');
  }

  const fetchedAt = now.toISOString();

  const [tariffContext, minuteData] = await Promise.all([
    loadTariffContext(installationId, date),
    fetchMinuteData(date, effectiveTimezone),
  ]);

  const dayDetail = buildDayDetail(date, minuteData, fetchedAt, effectiveTimezone);

  // For historical dates: never 'stale' — only healthy/warning/disconnected
  const screenState: 'healthy' | 'warning' | 'disconnected' =
    minuteData.length === 0
      ? 'disconnected'
      : dayDetail.health.hasSuspiciousReadings
        ? 'warning'
        : 'healthy';

  const financialEstimate =
    tariffContext && screenState !== 'disconnected'
      ? computeFinancialEstimate(dayDetail.summary, tariffContext)
      : null;

  const minuteChartData = minuteDataToChartPoints(minuteData);
  const halfHourChartData = periodDataToChartPoints(dayDetail.halfHourData, 30);
  const hourChartData = periodDataToChartPoints(dayDetail.hourData, 60);
  const costChartData =
    tariffContext && screenState !== 'disconnected'
      ? periodDataToCostPoints(dayDetail.halfHourData, date, tariffContext)
      : [];

  const dayTotals =
    screenState !== 'disconnected'
      ? {
          generatedKwh: dayDetail.summary.totalGeneratedKwh,
          consumedKwh: dayDetail.summary.totalConsumedKwh,
          importKwh: dayDetail.summary.totalImportKwh,
          exportKwh: dayDetail.summary.totalExportKwh,
          immersionDivertedKwh: dayDetail.summary.totalImmersionDivertedKwh,
        }
      : null;

  return (
    <HistoricalDayScreen
      today={today}
      displayDate={formatDisplayDate(date, effectiveTimezone)}
      initialLiveTime={new Intl.DateTimeFormat('en-IE', {
        timeZone: effectiveTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now)}
      selectedDate={date}
      installationContext={
        installationContext
          ? {
              name: installationContext.name,
              arrayCapacityKw: installationContext.arrayCapacityKw,
            }
          : null
      }
      screenState={screenState}
      health={{
        minutesStale: null,
        lastReadingLocalTime: getLastReadingLocalTime(minuteData),
        refreshedAtLocalTime: new Intl.DateTimeFormat('en-IE', {
          timeZone: effectiveTimezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now),
        uptimePercent: dayDetail.health.uptimePercent,
        expectedMinutes: dayDetail.health.expectedMinutes,
        coveredMinutes: dayDetail.health.coveredMinutes,
        incidents: dayDetail.health.incidents,
        primaryIncident: dayDetail.health.primaryIncident,
      }}
      timezone={effectiveTimezone}
      hasTariff={tariffContext !== null}
      minuteChartData={minuteChartData}
      halfHourChartData={halfHourChartData}
      hourChartData={hourChartData}
      costChartData={costChartData}
      dayTotals={dayTotals}
      financialEstimate={financialEstimate}
    />
  );
}
