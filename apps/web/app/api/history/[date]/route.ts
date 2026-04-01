import type { NextRequest } from 'next/server';
import { fetchMinuteData } from '../../../../src/providers/v1/adapter';
import { buildDayDetail } from '../../../../src/live/normalizer';
import {
  loadInstallationContext,
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
import type { HealthIncident } from '../../../../src/live/types';

// ---------------------------------------------------------------------------
// Single-user seed path — no auth or user selection for the local-dev slice.
// ---------------------------------------------------------------------------
const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

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

  const now = new Date();
  const installationContext = await loadInstallationContext(SEED_INSTALLATION_ID);
  const effectiveTimezone = installationContext?.timezone ?? 'Europe/Dublin';
  const today = getTodayLocalDate(effectiveTimezone);

  if (date >= today) {
    return Response.json(
      { error: 'Date must be before today. Use /api/live/day for current data.' },
      { status: 404 },
    );
  }

  const fetchedAt = now.toISOString();

  const [tariffContext, minuteData] = await Promise.all([
    loadTariffContext(SEED_INSTALLATION_ID, date),
    fetchMinuteData(date, effectiveTimezone),
  ]);

  const dayDetail = buildDayDetail(date, minuteData, fetchedAt, effectiveTimezone);

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
