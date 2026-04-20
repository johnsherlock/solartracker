import type { NextRequest } from 'next/server';
import { buildDayDetail } from '../../../../src/live/normalizer';
import {
  loadInstallationContext,
  loadProviderConnection,
  loadTariffContext,
  computeFinancialEstimate,
  getLastReadingLocalTime,
  minuteDataToChartPoints,
  periodDataToChartPoints,
  periodDataToCostPoints,
  type FinancialEstimate,
  type LivePoint,
  type CostPoint,
} from '../../../../src/live/loader';
import { fetchDayRecords } from '../../../../src/providers/myenergi/client';
import { normaliseEddiRecords } from '../../../../src/providers/myenergi/adapter';
import { resolveMyEnergiCredentials } from '../../../../src/providers/myenergi/credentials';
import type { HealthIncident } from '../../../../src/live/types';
import { resolveEffectiveInstallationId } from '../../../../src/installation-helpers';

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

// ---------------------------------------------------------------------------
// Payload type — exported so dayCache and P-031 can share the same shape.
// ---------------------------------------------------------------------------

export type HistoricalDayPayload = {
  today: string;
  displayDate: string;
  selectedDate: string;
  installationContext: { name: string; arrayCapacityKw: number | null } | null;
  timezone: string;
  screenState: 'healthy' | 'warning' | 'disconnected';
  health: {
    minutesStale: null;
    lastReadingLocalTime: string | null;
    refreshedAtLocalTime: string;
    uptimePercent: number;
    expectedMinutes: number;
    coveredMinutes: number;
    incidents: HealthIncident[];
    primaryIncident: HealthIncident | null;
  };
  hasTariff: boolean;
  minuteChartData: LivePoint[];
  halfHourChartData: LivePoint[];
  hourChartData: LivePoint[];
  costChartData: CostPoint[];
  dayTotals: {
    generatedKwh: number;
    consumedKwh: number;
    importKwh: number;
    exportKwh: number;
    immersionDivertedKwh: number;
  } | null;
  financialEstimate: FinancialEstimate | null;
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;

  if (!DATE_PATTERN.test(date) || isNaN(new Date(`${date}T12:00:00`).getTime())) {
    return Response.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const installationContext = await loadInstallationContext(installationId);
  const effectiveTimezone = installationContext?.timezone ?? 'Europe/Dublin';
  const today = getTodayLocalDate(effectiveTimezone);

  if (date >= today) {
    return Response.json(
      { error: 'Date must be before today. Use /api/live/day for current data.' },
      { status: 404 },
    );
  }

  const fetchedAt = now.toISOString();

  const providerConnection = await loadProviderConnection(installationId);
  const credentials = resolveMyEnergiCredentials(providerConnection?.credentialRef);

  if (!credentials) {
    return Response.json(
      { error: 'No valid provider credentials configured for this installation.' },
      { status: 503 },
    );
  }

  const [tariffContext, fetchResult] = await Promise.all([
    loadTariffContext(installationId, date),
    fetchDayRecords(date, effectiveTimezone, credentials),
  ]);

  let minuteData = fetchResult.ok
    ? normaliseEddiRecords(fetchResult.records, date, effectiveTimezone)
    : [];

  if (!fetchResult.ok && fetchResult.kind === 'auth-failure') {
    return Response.json({ error: 'Provider authentication failed.' }, { status: 502 });
  }

  const dayDetail = buildDayDetail(date, minuteData, fetchedAt, effectiveTimezone, 'myenergi');

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

  const refreshedAtLocalTime = new Intl.DateTimeFormat('en-IE', {
    timeZone: effectiveTimezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const payload: HistoricalDayPayload = {
    today,
    displayDate: formatDisplayDate(date, effectiveTimezone),
    selectedDate: date,
    installationContext: installationContext
      ? { name: installationContext.name, arrayCapacityKw: installationContext.arrayCapacityKw }
      : null,
    timezone: effectiveTimezone,
    screenState,
    health: {
      minutesStale: null,
      lastReadingLocalTime: getLastReadingLocalTime(minuteData),
      refreshedAtLocalTime,
      uptimePercent: dayDetail.health.uptimePercent,
      expectedMinutes: dayDetail.health.expectedMinutes,
      coveredMinutes: dayDetail.health.coveredMinutes,
      incidents: dayDetail.health.incidents,
      primaryIncident: dayDetail.health.primaryIncident,
    },
    hasTariff: tariffContext !== null,
    minuteChartData,
    halfHourChartData,
    hourChartData,
    costChartData,
    dayTotals,
    financialEstimate,
  };

  return Response.json(payload);
}
