import { redirect } from 'next/navigation';
import { fetchDayRecords } from '@/src/providers/myenergi/client';
import { normaliseEddiRecords } from '@/src/providers/myenergi/adapter';
import { resolveMyEnergiCredentials } from '@/src/providers/myenergi/credentials';
import { buildDayDetail } from '@/src/live/normalizer';
import type { MinuteReading } from '@/src/live/types';
import {
  loadInstallationContext,
  loadTariffContext,
  loadProviderConnection,
  computeFinancialEstimate,
  deriveScreenState,
  getMinutesStale,
  getLastReadingLocalTime,
  getCurrentMetrics,
  minuteDataToChartPoints,
  periodDataToChartPoints,
  periodDataToCostPoints,
} from '@/src/live/loader';
import { getLiveWeatherContext } from '@/src/weather/getLiveWeatherContext';
import { LiveScreen } from './LiveScreen';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Single-user seed path — no auth or user selection for the local-dev slice.
// ---------------------------------------------------------------------------
const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

function getTodayLocalDate(timezone: string): string {
  // Returns "YYYY-MM-DD" in the installation timezone.
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

export const metadata = {
  title: 'Live — PV Manager',
  description: 'Real-time solar system status',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveSelectedDate(candidate: string | undefined, today: string): string {
  if (!candidate || !DATE_PATTERN.test(candidate)) return today;
  return candidate > today ? today : candidate;
}

export default async function LivePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const now = new Date();
  const installationContext = await loadInstallationContext(SEED_INSTALLATION_ID);
  const effectiveTimezone = installationContext?.timezone ?? 'Europe/Dublin';
  const today = getTodayLocalDate(effectiveTimezone);
  const params = await searchParams;

  // Redirect historical ?date= params to the dedicated history route.
  if (params?.date && DATE_PATTERN.test(params.date) && params.date < today) {
    redirect(`/history/${params.date}`);
  }

  const selectedDate = resolveSelectedDate(params?.date, today);
  const fetchedAt = now.toISOString();

  // Load tariff, provider credentials, and weather in parallel.
  const [tariffContext, providerConnection, weatherResult] = await Promise.all([
    loadTariffContext(SEED_INSTALLATION_ID, selectedDate),
    loadProviderConnection(SEED_INSTALLATION_ID),
    getLiveWeatherContext(SEED_INSTALLATION_ID),
  ]);

  // Fetch live minute data from MyEnergi via the rewrite-owned adapter.
  const credentials = resolveMyEnergiCredentials(providerConnection?.credentialRef);
  let minuteData: MinuteReading[] = [];
  if (credentials) {
    const fetchResult = await fetchDayRecords(selectedDate, effectiveTimezone, credentials);
    if (fetchResult.ok) {
      minuteData = normaliseEddiRecords(fetchResult.records, selectedDate, effectiveTimezone);
    } else if (fetchResult.kind === 'empty-day') {
      minuteData = normaliseEddiRecords([], selectedDate, effectiveTimezone);
    }
    // auth-failure and upstream-error leave minuteData empty → disconnected screen state
  }

  // Build the normalised day-detail from raw minute readings.
  const dayDetail = buildDayDetail(selectedDate, minuteData, fetchedAt, effectiveTimezone);

  // Derive screen state from health signals and freshness.
  // Historical dates are redirected above, so selectedDate is always today here.
  const screenState = deriveScreenState(dayDetail.health, minuteData, now, effectiveTimezone);

  // Current instantaneous metrics from the most recent reading.
  const currentMetrics = getCurrentMetrics(minuteData);

  // Financial estimate is only meaningful when tariff context is present
  // and we have some data to compute against.
  const financialEstimate =
    tariffContext && screenState !== 'disconnected'
      ? computeFinancialEstimate(dayDetail.summary, tariffContext)
      : null;

  // Pre-compute chart data at all three resolutions so the client can
  // switch resolution without a server round-trip.
  const minuteChartData = minuteDataToChartPoints(minuteData);
  const halfHourChartData = periodDataToChartPoints(dayDetail.halfHourData, 30);
  const hourChartData = periodDataToChartPoints(dayDetail.hourData, 60);
  const costChartData =
    tariffContext && screenState !== 'disconnected'
      ? periodDataToCostPoints(dayDetail.halfHourData, selectedDate, tariffContext)
      : [];

  const todayTotals =
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
    <LiveScreen
      today={today}
      displayDate={formatDisplayDate(selectedDate, effectiveTimezone)}
      initialLiveTime={new Intl.DateTimeFormat('en-IE', {
        timeZone: effectiveTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now)}
      selectedDate={selectedDate}
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
        minutesStale: getMinutesStale(minuteData, now, effectiveTimezone),
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
      weatherResult={weatherResult}
      hasCapacity={installationContext?.arrayCapacityKw != null}
      currentMetrics={currentMetrics}
      minuteChartData={minuteChartData}
      halfHourChartData={halfHourChartData}
      hourChartData={hourChartData}
      costChartData={costChartData}
      todayTotals={todayTotals}
      financialEstimate={financialEstimate}
    />
  );
}
