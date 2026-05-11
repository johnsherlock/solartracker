'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  PieChart,
  Sun,
  Sunrise,
  Sunset,
  WifiOff,
} from 'lucide-react';
import type { FinancialEstimate, HistoricalMetricRanks, LivePoint } from '@/src/live/loader';
import type { TariffBreakdownSlice } from '@/src/live/loader';
import { StaleTariffBanner } from '@/src/components/StaleTariffBanner';
import type { StaleTariffWarning } from '@/src/tariffs/stale-check';
import { EChart } from '@/src/live/EChartsWrapper';
import { LiveClockChip } from '@/src/components/LiveClockChip';
import {
  buildHistoricalTrendIndicator,
  getMetricPolarity,
} from '@/src/live/dayCardModel';
import {
  DayTrendChart,
  DayValuePanel,
  DayTotalsPanel,
  SolarCoveragePanel,
} from '@/app/live/DayAnalysis';
import {
  type Resolution,
  type ViewMode,
  type SeriesKey,
  SERIES_ORDER,
  MINUTE_DEFAULT_SERIES,
  applyViewMode,
  applyCostViewMode,
  addDays,
  formatEuro,
  formatKwh,
} from '@/src/live/chartUtils';
import type { CostPoint } from '@/src/live/loader';
import { buildHistoricalNotesModel, type HistoricalNotesModel } from '@/src/live/historicalNotes';
import { buildTariffBreakdownOption } from '@/src/live/echartsOptions';
import {
  resolveHistoricalSwipeTarget,
  shouldIgnoreSwipeTarget,
} from '@/src/live/swipeNavigation';
import * as dayCache from '@/src/live/dayCache';
import { extractHistoricalDate, resolveClientNavigation } from '@/src/live/clientNavigation';
import type { HistoricalDayPayload } from '@/app/api/history/[date]/route';
import { buildRangeUrl } from '@/src/range/presets';
import { RangePickerPopover } from '@/src/components/RangePickerPopover';
import type { NavigationTarget } from '@/src/components/RangePickerPopover';
import type { SunEvents } from '@/src/weather/types';
import { SignedInHeader } from '@/src/components/SignedInHeader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

export type HistoricalDayScreenProps = {
  today: string;
  displayDate: string;
  initialLiveTime: string;
  selectedDate: string;
  installationContext: {
    name: string;
    arrayCapacityKw: number | null;
    locationLatitude: number | null;
    locationLongitude: number | null;
  } | null;
  timezone: string;
  screenState: ScreenState;
  health: {
    minutesStale: number | null;
    lastReadingLocalTime: string | null;
    refreshedAtLocalTime: string;
    uptimePercent: number;
    expectedMinutes: number;
    coveredMinutes: number;
    incidents: {
      id: string;
      kind: 'missing-interval';
      missingMinutes: number;
      gapStartsAt: string;
      gapEndsAt: string;
      message: string;
    }[];
    primaryIncident: {
      id: string;
      kind: 'missing-interval';
      missingMinutes: number;
      gapStartsAt: string;
      gapEndsAt: string;
      message: string;
    } | null;
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
  ytdMetricRanks: HistoricalMetricRanks;
  daylightCoverage: number | null;
  historicalSunEvents: SunEvents | null;
  tariffBreakdown: TariffBreakdownSlice[];
  financialEstimate: FinancialEstimate | null;
  repaymentCoverage: { amount: number; percent: number } | null;
  staleTariffWarning: StaleTariffWarning;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const ratio = clamp(t, 0, 1);
  const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio));
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

function getUptimeTone(
  uptimePercent: number,
): { border: string; background: string; text: string } {
  const red: [number, number, number] = [239, 68, 68];
  const orange: [number, number, number] = [249, 115, 22];
  const green: [number, number, number] = [34, 197, 94];

  let tone = red;
  if (uptimePercent >= 90) {
    tone =
      uptimePercent >= 100
        ? green
        : [
            Math.round(249 + (34 - 249) * ((uptimePercent - 90) / 10)),
            Math.round(115 + (197 - 115) * ((uptimePercent - 90) / 10)),
            Math.round(22 + (94 - 22) * ((uptimePercent - 90) / 10)),
          ];
  } else if (uptimePercent >= 80) {
    tone = [
      Math.round(239 + (249 - 239) * ((uptimePercent - 80) / 10)),
      Math.round(68 + (115 - 68) * ((uptimePercent - 80) / 10)),
      Math.round(68 + (22 - 68) * ((uptimePercent - 80) / 10)),
    ];
  }

  return {
    border: mixColor(tone, [15, 23, 42], 0.25),
    background: mixColor(tone, [2, 6, 23], 0.12),
    text: 'rgb(255 255 255)',
  };
}

function formatUptimePercent(uptimePercent: number): string {
  return `${Math.round(uptimePercent)}%`;
}

function formatMissingMinutesSummary(expectedMinutes: number, coveredMinutes: number): string {
  const missingMinutes = Math.max(0, expectedMinutes - coveredMinutes);
  if (missingMinutes === 0) {
    return 'Provider coverage is complete for the selected period.';
  }
  return `Provider coverage is slightly below complete: ${missingMinutes} minute${
    missingMinutes === 1 ? '' : 's'
  } ${missingMinutes === 1 ? 'is' : 'are'} missing, but ${
    missingMinutes === 1 ? 'it does' : 'they do'
  } not cross the outage threshold.`;
}

function getDismissalStorageKey(date: string, timezone: string): string {
  return `pv-manager:live-warning-dismissals:${timezone}:${date}`;
}

function getChartPrefsStorageKey(timezone: string): string {
  return `pv-manager:live-chart-prefs:${timezone}`;
}

function formatSunTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcIso));
}

function formatDaylightHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function snapMarkerTime(availableTimes: string[], utcIso: string, timezone: string): string | null {
  if (availableTimes.length === 0) return null;

  const targetTime = formatSunTime(utcIso, timezone);
  if (availableTimes.includes(targetTime)) {
    return targetTime;
  }

  const targetMinutes = Number(targetTime.slice(0, 2)) * 60 + Number(targetTime.slice(3, 5));
  let closestTime = availableTimes[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const time of availableTimes) {
    const timeMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const distance = Math.abs(timeMinutes - targetMinutes);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestTime = time;
    }
  }

  return closestTime;
}

function isResolution(value: string): value is Resolution {
  return value === '1min' || value === '30min' || value === '1hour';
}

function isViewMode(value: string): value is ViewMode {
  return value === 'line' || value === 'cumulative';
}

function isSeriesKey(value: string): value is SeriesKey {
  return SERIES_ORDER.includes(value as SeriesKey);
}

function propsToPayload(props: HistoricalDayScreenProps): HistoricalDayPayload {
  return {
    today: props.today,
    displayDate: props.displayDate,
    selectedDate: props.selectedDate,
    installationContext: props.installationContext,
    timezone: props.timezone,
    screenState: props.screenState as 'healthy' | 'warning' | 'disconnected',
    health: { ...props.health, minutesStale: null },
    hasTariff: props.hasTariff,
    minuteChartData: props.minuteChartData,
    halfHourChartData: props.halfHourChartData,
    hourChartData: props.hourChartData,
    costChartData: props.costChartData,
    dayTotals: props.dayTotals,
    ytdMetricRanks: props.ytdMetricRanks,
    daylightCoverage: props.daylightCoverage,
    historicalSunEvents: props.historicalSunEvents,
    tariffBreakdown: props.tariffBreakdown,
    financialEstimate: props.financialEstimate,
    repaymentCoverage: props.repaymentCoverage,
  };
}

// Minimum date we allow navigation back to (2 years ago from now)
const MIN_HISTORY_DATE = addDays(
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
  -730,
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


function WarningBanner({
  screenState,
  health,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: HistoricalDayScreenProps['health'];
  onOpenDetails?: () => void;
}) {
  if (screenState === 'healthy') return null;

  const config = {
    stale: {
      title: 'Partial data for this day',
      body: 'Not all minute readings were available for this historical date. Totals may be incomplete.',
      cta: 'Review Data Health',
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <Clock size={15} className="mt-0.5 shrink-0" />,
    },
    warning: {
      title: 'A data gap was detected for this day',
      body:
        health.primaryIncident?.message ??
        'A gap in coverage exists for this historical date.',
      cta: 'Review details',
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <AlertTriangle size={15} className="mt-0.5 shrink-0" />,
    },
    disconnected: {
      title: 'No data available for this day',
      body: 'No readings were found for this date in the provider feed.',
      cta: 'Review Data Health',
      className: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
      icon: <WifiOff size={15} className="mt-0.5 shrink-0" />,
    },
  }[screenState];

  return (
    <div className={`border-b px-4 py-3 ${config.className}`}>
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        {config.icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{config.title}</p>
          <p className="mt-0.5 text-sm text-inherit/80">{config.body}</p>
        </div>
        <button
          type="button"
          onClick={screenState === 'warning' ? onOpenDetails : undefined}
          className="text-xs font-semibold underline underline-offset-4"
        >
          {config.cta}
        </button>
      </div>
    </div>
  );
}

function WarningDetailsModal({
  health,
  open,
  selectedIncidentId,
  dismissedIncidentIds,
  onClose,
  onDismiss,
}: {
  health: HistoricalDayScreenProps['health'];
  open: boolean;
  selectedIncidentId: string | null;
  dismissedIncidentIds: string[];
  onClose: () => void;
  onDismiss: (incidentId: string) => void;
}) {
  if (!open) return null;

  const selectedIncident =
    health.incidents.find((incident) => incident.id === selectedIncidentId) ??
    health.primaryIncident ??
    health.incidents[0] ??
    null;
  const selectedIncidentDismissed =
    selectedIncident !== null && dismissedIncidentIds.includes(selectedIncident.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Data quality
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          {health.incidents.length > 0
            ? `${health.incidents.length} outage${health.incidents.length === 1 ? '' : 's'} detected for this day`
            : 'Data quality overview'}
        </h3>
        <p className="mt-3 text-sm text-slate-300">
          Based on expected provider minute coverage for this historical date.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Coverage</span>
            <span className="font-mono">
              {health.coveredMinutes} / {health.expectedMinutes} mins
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-slate-400">Data quality</span>
            <span className="font-mono">{formatUptimePercent(health.uptimePercent)}</span>
          </div>
        </div>
        {selectedIncident ? (
          <>
            <p className="mt-4 text-sm text-slate-300">{selectedIncident.message}</p>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Active selection</span>
                <span className="font-mono">
                  {selectedIncident.gapStartsAt} to {selectedIncident.gapEndsAt}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-slate-400">Missing minutes</span>
                <span className="font-mono">{selectedIncident.missingMinutes}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            {formatMissingMinutesSummary(health.expectedMinutes, health.coveredMinutes)}
          </p>
        )}
        {health.incidents.length > 0 && (
          <div className="mt-4 space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-3 py-3">
            {health.incidents.map((incident) => (
              <div
                key={incident.id}
                className={`rounded-2xl border px-3 py-3 text-sm ${
                  incident.id === selectedIncident?.id
                    ? 'border-orange-500/30 bg-orange-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-200">
                    {incident.gapStartsAt} to {incident.gapEndsAt}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-slate-400">
                    <span>{incident.missingMinutes} mins</span>
                    {dismissedIncidentIds.includes(incident.id) && (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                        Dismissed
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{incident.message}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-slate-400">
          This note is based on missing minute records in the provider feed. Dismissal is stored in
          this browser for the selected day, and dismissed incidents remain visible here for review.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Close
          </button>
          {selectedIncident && !selectedIncidentDismissed && (
            <button
              type="button"
              onClick={() => onDismiss(selectedIncident.id)}
              className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Dismiss warning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UptimeBadge({
  uptimePercent,
  isDisconnected,
  onOpenDetails,
}: {
  uptimePercent: number;
  isDisconnected: boolean;
  onOpenDetails: () => void;
}) {
  const tone = getUptimeTone(uptimePercent);
  const label = isDisconnected ? 'No feed' : 'Data quality';

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      title={label}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        borderColor: tone.border,
        backgroundColor: tone.background,
        color: tone.text,
      }}
    >
      {label} {formatUptimePercent(uptimePercent)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function HistoricalDayScreen(props: HistoricalDayScreenProps) {
  const { initialLiveTime } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Per-day display state — initialized from SSR props, updated on cache hits.
  // ---------------------------------------------------------------------------
  const [dayData, setDayData] = useState<HistoricalDayPayload>(() => propsToPayload(props));
  const [previousDayData, setPreviousDayData] = useState<HistoricalDayPayload | null>(null);

  // Re-sync from SSR props when the server provides a fresh date after a
  // cache-miss router.push() navigates to a new /history/[date] page.
  useEffect(() => {
    setDayData(propsToPayload(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedDate]);

  useEffect(() => {
    dayCache.prime(dayData.selectedDate, dayData);

    const previousDate = addDays(dayData.selectedDate, -1);
    setPreviousDayData(null);
    dayCache.prefetch(previousDate, dayData.today);

    const cached = dayCache.get(previousDate);
    if (!cached) return;

    let cancelled = false;
    cached
      .then((payload) => {
        if (!cancelled) {
          setPreviousDayData(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviousDayData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dayData]);

  const {
    today,
    displayDate,
    selectedDate,
    installationContext,
    timezone,
    screenState,
    health,
    hasTariff,
    minuteChartData,
    halfHourChartData,
    hourChartData,
    costChartData,
    dayTotals,
    ytdMetricRanks,
    daylightCoverage,
    historicalSunEvents,
    tariffBreakdown,
    financialEstimate,
    repaymentCoverage,
  } = dayData;
  const chartPrefsStorageKey = useMemo(() => getChartPrefsStorageKey(timezone), [timezone]);
  const [resolution, setResolution] = useState<Resolution>('1min');
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [activeSeries, setActiveSeries] = useState<SeriesKey[]>(MINUTE_DEFAULT_SERIES);
  const [chartPrefsReady, setChartPrefsReady] = useState(false);

  const [warningDetailsOpen, setWarningDetailsOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [dismissedIncidentIds, setDismissedIncidentIds] = useState<string[]>([]);

  // Swipe navigation — disabled; charts need free touch for drag/zoom
  const SWIPE_NAVIGATION_ENABLED = false;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const baseChartData = useMemo(() => {
    if (resolution === '30min') return halfHourChartData;
    if (resolution === '1hour') return hourChartData;
    return minuteChartData;
  }, [resolution, minuteChartData, halfHourChartData, hourChartData]);

  const chartData = useMemo(
    () => applyViewMode(baseChartData, viewMode, resolution),
    [baseChartData, viewMode, resolution],
  );

  const valueChartData = useMemo(
    () => applyCostViewMode(costChartData, viewMode),
    [costChartData, viewMode],
  );

  const overallSolarCoverage =
    dayTotals && dayTotals.consumedKwh > 0
      ? Math.round(
          Math.min(
            100,
            Math.max(
              0,
              ((dayTotals.consumedKwh - dayTotals.importKwh) / dayTotals.consumedKwh) * 100,
            ),
          ),
        )
      : null;

  const hoursAboveEightyPercentSolar = useMemo(() => {
    const qualifyingHours = minuteChartData.reduce((sum, point) => {
      const coverageRatio =
        point.consumption > 0
          ? Math.min(1, Math.max(0, (point.generation - point.export) / point.consumption))
          : point.generation > 0
            ? 1
            : 0;

      return coverageRatio > 0.8 ? sum + point.intervalHours : sum;
    }, 0);

    return Math.round(qualifyingHours * 10) / 10;
  }, [minuteChartData]);

  const previousDayLabel = useMemo(() => {
    if (!previousDayData) return null;
    return new Intl.DateTimeFormat('en-IE', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${previousDayData.selectedDate}T12:00:00`));
  }, [previousDayData]);

  const dayValueTrends = useMemo(() => ({
    import_cost: buildHistoricalTrendIndicator({
      current: financialEstimate?.importCost ?? null,
      previous: previousDayData?.financialEstimate?.importCost ?? null,
      polarity: getMetricPolarity('import_cost'),
      formatter: (value) => formatEuro(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    export_credit: buildHistoricalTrendIndicator({
      current: financialEstimate?.exportCredit ?? null,
      previous: previousDayData?.financialEstimate?.exportCredit ?? null,
      polarity: getMetricPolarity('export_credit'),
      formatter: (value) => formatEuro(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    onsite_solar_value: buildHistoricalTrendIndicator({
      current: financialEstimate?.solarSavings ?? null,
      previous: previousDayData?.financialEstimate?.solarSavings ?? null,
      polarity: getMetricPolarity('self_consumed_value'),
      formatter: (value) => formatEuro(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    net_energy_bill: buildHistoricalTrendIndicator({
      current: financialEstimate?.netBillImpact ?? null,
      previous: previousDayData?.financialEstimate?.netBillImpact ?? null,
      polarity: getMetricPolarity('net_energy_bill'),
      formatter: (value) => formatEuro(value, true),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    total_solar_value: buildHistoricalTrendIndicator({
      current:
        financialEstimate != null
          ? financialEstimate.solarSavings + financialEstimate.exportCredit
          : null,
      previous:
        previousDayData?.financialEstimate != null
          ? previousDayData.financialEstimate.solarSavings +
            previousDayData.financialEstimate.exportCredit
          : null,
      polarity: getMetricPolarity('total_solar_value'),
      formatter: (value) => formatEuro(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    prorata_coverage: buildHistoricalTrendIndicator({
      current: repaymentCoverage?.percent ?? null,
      previous: previousDayData?.repaymentCoverage?.percent ?? null,
      polarity: getMetricPolarity('prorata_coverage'),
      formatter: (value) => `${Math.round(value)}%`,
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
  }), [financialEstimate, previousDayData, previousDayLabel, repaymentCoverage]);

  const dayTotalTrends = useMemo(() => ({
    generation_kwh: buildHistoricalTrendIndicator({
      current: dayTotals?.generatedKwh ?? null,
      previous: previousDayData?.dayTotals?.generatedKwh ?? null,
      polarity: getMetricPolarity('generation_kwh'),
      formatter: (value) => formatKwh(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    consumed_kwh: buildHistoricalTrendIndicator({
      current: dayTotals?.consumedKwh ?? null,
      previous: previousDayData?.dayTotals?.consumedKwh ?? null,
      polarity: getMetricPolarity('consumed_kwh'),
      formatter: (value) => formatKwh(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    import_kwh: buildHistoricalTrendIndicator({
      current: dayTotals?.importKwh ?? null,
      previous: previousDayData?.dayTotals?.importKwh ?? null,
      polarity: getMetricPolarity('import_kwh'),
      formatter: (value) => formatKwh(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    export_kwh: buildHistoricalTrendIndicator({
      current: dayTotals?.exportKwh ?? null,
      previous: previousDayData?.dayTotals?.exportKwh ?? null,
      polarity: getMetricPolarity('export_kwh'),
      formatter: (value) => formatKwh(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
    immersion_kwh: buildHistoricalTrendIndicator({
      current: dayTotals?.immersionDivertedKwh ?? null,
      previous: previousDayData?.dayTotals?.immersionDivertedKwh ?? null,
      polarity: getMetricPolarity('immersion_kwh'),
      formatter: (value) => formatKwh(value),
      comparisonLabel: previousDayLabel ?? 'the previous day',
    }),
  }), [dayTotals, previousDayData, previousDayLabel]);

  const dismissalStorageKey = useMemo(
    () => getDismissalStorageKey(selectedDate, timezone),
    [selectedDate, timezone],
  );

  const activeIncidents = useMemo(
    () => health.incidents.filter((incident) => !dismissedIncidentIds.includes(incident.id)),
    [dismissedIncidentIds, health.incidents],
  );

  const primaryActiveIncident = activeIncidents[0] ?? null;

  const displayScreenState: ScreenState =
    screenState === 'warning' && !primaryActiveIncident ? 'healthy' : screenState;

  const displayHealth = useMemo(
    () => ({
      ...health,
      incidents: health.incidents,
      primaryIncident: primaryActiveIncident,
    }),
    [health, primaryActiveIncident],
  );

  // Chart prefs persistence
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chartPrefsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setResolution(isResolution(parsed?.resolution) ? parsed.resolution : '1min');
        setViewMode(isViewMode(parsed?.viewMode) ? parsed.viewMode : 'line');
        const series = Array.isArray(parsed?.activeSeries)
          ? parsed.activeSeries.filter((value: string) => isSeriesKey(value))
          : [];
        setActiveSeries(series.length > 0 ? series : MINUTE_DEFAULT_SERIES);
      }
    } catch {
      // Storage read failed — leave state at defaults already set by useState.
    } finally {
      setChartPrefsReady(true);
    }
  }, [chartPrefsStorageKey]);

  useEffect(() => {
    setActiveSeries((current) => {
      if (current.length === 0) {
        return resolution === '1min' ? MINUTE_DEFAULT_SERIES : SERIES_ORDER;
      }
      const next = current.filter((series) => SERIES_ORDER.includes(series));
      return next.length > 0 ? next : resolution === '1min' ? MINUTE_DEFAULT_SERIES : SERIES_ORDER;
    });
  }, [resolution]);

  useEffect(() => {
    if (!chartPrefsReady) return;
    try {
      window.localStorage.setItem(
        chartPrefsStorageKey,
        JSON.stringify({ resolution, viewMode, activeSeries }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [activeSeries, chartPrefsReady, chartPrefsStorageKey, resolution, viewMode]);

  // Dismissal persistence
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(dismissalStorageKey);
      if (!raw) {
        setDismissedIncidentIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setDismissedIncidentIds(parsed.filter((id): id is string => typeof id === 'string'));
      } else {
        setDismissedIncidentIds([]);
      }
    } catch {
      setDismissedIncidentIds([]);
    }
  }, [dismissalStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        dismissalStorageKey,
        JSON.stringify(
          dismissedIncidentIds.filter((id) =>
            health.incidents.some((incident) => incident.id === id),
          ),
        ),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [dismissalStorageKey, dismissedIncidentIds, health.incidents]);

  // Prefetch adjacent day payloads into the client-side cache.
  useEffect(() => {
    const prevDate = addDays(selectedDate, -1);
    const nextDate = addDays(selectedDate, 1);
    dayCache.prefetch(prevDate, today);
    if (nextDate < today) {
      dayCache.prefetch(nextDate, today);
    }
  }, [selectedDate, today]);

  async function navigateToDate(date: string) {
    // Today or future → go to Live (not a historical-day cache concern).
    if (date >= today) {
      startTransition(() => router.push('/live'));
      return;
    }

    const result = await resolveClientNavigation(date, today, dayCache.get);

    if (result.type === 'cache-hit') {
      // Instant client-side swap — no server round-trip.
      setDayData(result.payload);
      window.history.pushState({}, '', `/history/${date}`);
      // Slide the prefetch window forward from the new date.
      const prevDate = addDays(date, -1);
      const nextDate = addDays(date, 1);
      dayCache.prefetch(prevDate, result.payload.today);
      if (nextDate < result.payload.today) {
        dayCache.prefetch(nextDate, result.payload.today);
      }
      return;
    }

    // Cache miss — fall back to server render.
    startTransition(() => router.push(`/history/${date}`));
  }

  function handlePickerNavigate(target: NavigationTarget) {
    setPickerOpen(false);
    if (target.type === 'live') {
      startTransition(() => router.push('/live'));
    } else if (target.type === 'history') {
      void navigateToDate(target.date);
    } else {
      startTransition(() => router.push(buildRangeUrl(target.range)));
    }
  }

  // Handle browser back/forward so the URL stack remains consistent with
  // client-managed pushState history entries.
  useEffect(() => {
    async function handlePopstate() {
      const date = extractHistoricalDate(window.location.pathname);
      if (!date) return;

      const result = await resolveClientNavigation(date, today, dayCache.get);

      if (result.type === 'cache-hit') {
        setDayData(result.payload);
        const prevDate = addDays(date, -1);
        const nextDate = addDays(date, 1);
        dayCache.prefetch(prevDate, result.payload.today);
        if (nextDate < result.payload.today) {
          dayCache.prefetch(nextDate, result.payload.today);
        }
        return;
      }

      // Cache miss — let Next.js server-render the popped URL.
      router.push(window.location.pathname);
    }

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [today, router]);

  function toggleSeries(series: SeriesKey) {
    setActiveSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1 ? current : current.filter((item) => item !== series);
      }
      return [...current, series];
    });
  }

  // Prev/next day navigation
  const prevDay = addDays(selectedDate, -1);
  const nextDay = addDays(selectedDate, 1);
  const canGoPrev = prevDay >= MIN_HISTORY_DATE;
  const isNextToday = nextDay >= today;

  function handlePrevDay() {
    if (!canGoPrev) return;
    void navigateToDate(prevDay);
  }

  function handleNextDay() {
    void navigateToDate(nextDay);
  }

  // Touch swipe handlers — kept for future re-enabling via settings
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!SWIPE_NAVIGATION_ENABLED) return;
    const target = e.target as Element;
    if (e.touches.length !== 1 || shouldIgnoreSwipeTarget(target)) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (!SWIPE_NAVIGATION_ENABLED) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    const routeTarget = resolveHistoricalSwipeTarget(deltaX, deltaY, selectedDate, today);
    if (!routeTarget) return;
    if (routeTarget === '/live') {
      startTransition(() => router.push('/live'));
      return;
    }
    const date = extractHistoricalDate(routeTarget);
    if (date) void navigateToDate(date);
  }

  function handleTouchCancel() {
    if (!SWIPE_NAVIGATION_ENABLED) return;
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const isDisconnected = displayScreenState === 'disconnected';
  const historicalNotes = useMemo(
    () =>
      buildHistoricalNotesModel({
        screenState: displayScreenState,
        dayTotals,
        health: {
          expectedMinutes: health.expectedMinutes,
          coveredMinutes: health.coveredMinutes,
          uptimePercent: health.uptimePercent,
          incidents: activeIncidents,
        },
        hasTariff,
        financialEstimate,
      }),
    [
      activeIncidents,
      dayTotals,
      displayScreenState,
      financialEstimate,
      hasTariff,
      health.coveredMinutes,
      health.expectedMinutes,
      health.uptimePercent,
    ],
  );

  const sunMarkers = useMemo(() => {
    if (!historicalSunEvents) {
      return { energy: [], cost: [] };
    }

    const energyTimes = baseChartData.map((point) => point.time);
    const costTimes = valueChartData.map((point) => point.time);
    const markerSpecs = [
      { utcIso: historicalSunEvents.sunriseUtc, label: 'Sunrise' },
      { utcIso: historicalSunEvents.solarNoonUtc, label: 'Solar noon' },
      { utcIso: historicalSunEvents.sunsetUtc, label: 'Sunset' },
    ];

    return {
      energy: markerSpecs
        .map((marker) => ({
          time: snapMarkerTime(energyTimes, marker.utcIso, timezone),
          label: marker.label,
        }))
        .filter((marker): marker is { time: string; label: string } => marker.time != null),
      cost: markerSpecs
        .map((marker) => ({
          time: snapMarkerTime(costTimes, marker.utcIso, timezone),
          label: marker.label,
        }))
        .filter((marker): marker is { time: string; label: string } => marker.time != null),
    };
  }, [baseChartData, historicalSunEvents, timezone, valueChartData]);

  return (
    <div
      className={`min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)] font-sans text-slate-100 ${isPending ? 'cursor-wait' : ''}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {isPending && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden">
          <div
            className="h-full w-full animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #38bdf8 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      )}
      {/* Nav bar */}
      <SignedInHeader
        left={
          <>
            <button
              type="button"
              onClick={() => startTransition(() => router.push('/live'))}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Live</span>
            </button>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-semibold text-slate-100">Historical Day</span>
          </>
        }
        actions={
          <Link
            href="/calendar"
            title="Calendar"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            <Calendar size={14} />
          </Link>
        }
      />

      <WarningBanner
        screenState={displayScreenState}
        health={displayHealth}
        onOpenDetails={() => {
          setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
          setWarningDetailsOpen(true);
        }}
      />

      {/* Control bar */}
      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          {/* Left spacer */}
          <div className="flex-1" />

          {/* Center: date navigation */}
          <div className="relative flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={!canGoPrev}
              title="Previous day"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300"
            >
              <Calendar size={12} />
              <span className="whitespace-nowrap">{displayDate}</span>
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              title={isNextToday ? 'Go to live' : 'Next day'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <ChevronRight size={14} />
            </button>

            {pickerOpen && (
              <RangePickerPopover
                today={today}
                earliestDate={null}
                activeRange={null}
                activeDate={selectedDate}
                onNavigate={handlePickerNavigate}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>

          {/* Right: live time + uptime (desktop only) */}
          <div className="flex flex-1 items-center justify-end gap-2 text-xs text-slate-400">
            <LiveClockChip
              timezone={timezone}
              initialTime={initialLiveTime}
              className="hidden sm:inline-flex min-w-[92px] justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5"
            />
            <span className="hidden sm:inline-flex">
              <UptimeBadge
                uptimePercent={health.uptimePercent}
                isDisconnected={isDisconnected}
                onOpenDetails={() => {
                  setSelectedIncidentId(
                    primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null,
                  );
                  setWarningDetailsOpen(true);
                }}
              />
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <StaleTariffBanner warning={props.staleTariffWarning} />
        <section className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <DayTrendChart
              mode="historical"
              data={chartData}
              costData={valueChartData}
              sunMarkers={sunMarkers}
              screenState={displayScreenState}
              resolution={resolution}
              onResolutionChange={setResolution}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeSeries={activeSeries}
              onToggleSeries={toggleSeries}
              footer={<HistoricalStoryArticle model={historicalNotes} />}
            />

            <div className="space-y-4">
              <DayValuePanel
                mode="historical"
                hasTariff={hasTariff}
                estimate={financialEstimate}
                selectedDate={selectedDate}
                rankings={ytdMetricRanks}
                repaymentCoverage={repaymentCoverage}
                trends={dayValueTrends}
              />
              <DayTotalsPanel
                mode="historical"
                totals={dayTotals}
                screenState={displayScreenState}
                selectedDate={selectedDate}
                rankings={ytdMetricRanks}
                trends={dayTotalTrends}
              />
              <SolarCoveragePanel
                mode="historical"
                chartData={baseChartData}
                sunMarkers={sunMarkers.energy}
                overallSolarCoverage={overallSolarCoverage}
                historicalHoursAboveThreshold={hoursAboveEightyPercentSolar}
                historicalDaylightCoverage={daylightCoverage}
              />
              <SolarContextHistoryPanel
                sunEvents={historicalSunEvents}
                timezone={timezone}
                hasLocation={
                  installationContext?.locationLatitude != null &&
                  installationContext?.locationLongitude != null
                }
              />
              <TariffBreakdownPanel
                hasTariff={hasTariff}
                breakdown={tariffBreakdown}
              />
            </div>
          </div>
        </section>
      </main>

      <WarningDetailsModal
        health={displayHealth}
        open={warningDetailsOpen}
        selectedIncidentId={selectedIncidentId}
        dismissedIncidentIds={dismissedIncidentIds}
        onClose={() => setWarningDetailsOpen(false)}
        onDismiss={(incidentId) => {
          setDismissedIncidentIds((current) =>
            current.includes(incidentId) ? current : [...current, incidentId],
          );
          const nextIncident = activeIncidents.find((incident) => incident.id !== incidentId);
          setSelectedIncidentId(nextIncident?.id ?? incidentId);
          if (!nextIncident && activeIncidents.length <= 1) {
            setWarningDetailsOpen(false);
          }
        }}
      />
    </div>
  );
}

function storyEmoji(title: string): string {
  if (title.includes('Generation')) return '☀️';
  if (title.includes('Grid')) return '🏠';
  if (title.includes('Export')) return '🔁';
  if (title.includes('Coverage')) return '🧭';
  if (title.includes('Tariff')) return '💶';
  return '•';
}

function HistoricalStoryArticle({
  model,
}: {
  model: HistoricalNotesModel;
}) {
  return (
    <article>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Story
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-50">{model.heading}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{model.summary}</p>
      <div className="mt-5 space-y-5">
        {model.notes.map((note) => {
          const toneClasses =
            note.tone === 'good'
              ? 'text-emerald-50'
              : note.tone === 'caution'
                ? 'text-amber-50'
                : 'text-slate-100';

          return (
            <section key={note.title}>
              <h4 className={`text-base font-semibold ${toneClasses}`}>
                {storyEmoji(note.title)} {note.title}
              </h4>
              <p className="mt-1 text-sm leading-7 text-slate-300">{note.body}</p>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function HistoryInfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="text-amber-300">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-mono text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function SolarContextHistoryPanel({
  sunEvents,
  timezone,
  hasLocation,
}: {
  sunEvents: SunEvents | null;
  timezone: string;
  hasLocation: boolean;
}) {
  if (!hasLocation) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Solar context
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Add coordinates to unlock daylight context
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Sunrise, sunset, solar noon, and daylight hours all come from the installation location.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Solar context
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Sun timings for the day</h3>
        </div>
        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 p-2 text-amber-300">
          <Sun size={18} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <HistoryInfoTile
          icon={<Sunrise size={14} />}
          label="Sunrise"
          value={sunEvents ? formatSunTime(sunEvents.sunriseUtc, timezone) : '—'}
        />
        <HistoryInfoTile
          icon={<Sun size={14} />}
          label="Solar noon"
          value={sunEvents ? formatSunTime(sunEvents.solarNoonUtc, timezone) : '—'}
        />
        <HistoryInfoTile
          icon={<Sunset size={14} />}
          label="Sunset"
          value={sunEvents ? formatSunTime(sunEvents.sunsetUtc, timezone) : '—'}
        />
        <HistoryInfoTile
          icon={<Activity size={14} />}
          label="Daylight hours"
          value={sunEvents ? formatDaylightHours(sunEvents.daylightSeconds) : '—'}
        />
      </div>
    </div>
  );
}

function TariffBreakdownPanel({
  hasTariff,
  breakdown,
}: {
  hasTariff: boolean;
  breakdown: TariffBreakdownSlice[];
}) {
  if (!hasTariff) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Value breakdown
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Add tariff details to unlock period breakdown
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          This view splits import cost and onsite solar value by the tariff periods that applied on the selected day.
        </p>
        <Link
          href="/settings/tariffs"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300"
        >
          Add tariff details <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Value breakdown
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Tariff-period value mix</h3>
          <p className="mt-1 text-sm text-slate-400">
            Outer ring shows import cost by tariff period. Inner ring shows the value of self-consumed solar in those same periods.
          </p>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
          <PieChart size={18} />
        </div>
      </div>
      <div className="mt-4 h-[320px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {breakdown.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No tariff-backed period data available
          </div>
        ) : (
          <EChart
            option={buildTariffBreakdownOption(breakdown)}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Outer ring: import cost</span>
        <span>Inner ring: onsite solar value</span>
      </div>
    </div>
  );
}
