'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import type { FinancialEstimate, LivePoint } from '@/src/live/loader';
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
  formatClockTime,
  parseIsoDate,
  addDays,
  startOfMonth,
  shiftMonth,
  formatMonthYear,
  getMonthName,
  getMonthDays,
} from '@/src/live/chartUtils';
import type { CostPoint } from '@/src/live/loader';
import { buildHistoricalNotesModel, type HistoricalNotesModel } from '@/src/live/historicalNotes';
import {
  resolveHistoricalSwipeTarget,
  shouldIgnoreSwipeTarget,
} from '@/src/live/swipeNavigation';
import * as dayCache from '@/src/live/dayCache';
import { extractHistoricalDate, resolveClientNavigation } from '@/src/live/clientNavigation';
import type { HistoricalDayPayload } from '@/app/api/history/[date]/route';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

export type HistoricalDayScreenProps = {
  today: string;
  displayDate: string;
  initialLiveTime: string;
  selectedDate: string;
  installationContext: { name: string; arrayCapacityKw: number | null } | null;
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
  financialEstimate: FinancialEstimate | null;
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
    financialEstimate: props.financialEstimate,
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

function TrustBadge({
  screenState,
  health,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: HistoricalDayScreenProps['health'];
  onOpenDetails?: () => void;
}) {
  function label(): string {
    switch (screenState) {
      case 'healthy':
        return `Data for ${health.refreshedAtLocalTime}`;
      case 'stale':
        return health.lastReadingLocalTime
          ? `Last reading ${health.lastReadingLocalTime}`
          : 'Partial data';
      case 'warning':
        return 'Data quality review needed';
      case 'disconnected':
        return 'No data for this day';
    }
  }

  const config: Record<ScreenState, { icon: ReactNode; className: string }> = {
    healthy: {
      icon: <CheckCircle2 size={13} />,
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    stale: {
      icon: <Clock size={13} />,
      className: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    warning: {
      icon: <TriangleAlert size={13} />,
      className: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    disconnected: {
      icon: <WifiOff size={13} />,
      className: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    },
  };

  const item = config[screenState];
  return (
    <button
      type="button"
      onClick={screenState === 'warning' ? onOpenDetails : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${item.className}`}
    >
      {item.icon}
      {label()}
    </button>
  );
}

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

function DatePickerControl({
  selectedDate,
  displayDate,
  today,
  onSelectDate,
}: {
  selectedDate: string;
  displayDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => `${selectedDate.slice(0, 7)}-01`);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const days = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    setVisibleMonth(`${selectedDate.slice(0, 7)}-01`);
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300"
      >
        <Calendar size={12} />
        <span>{displayDate}</span>
      </button>

      {open && (
        <div
          data-swipe-ignore="true"
          className="absolute left-0 top-full z-40 mt-2 w-[280px] rounded-[20px] border border-slate-800 bg-[#111b2b] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.5)]"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -12))}
              className="rounded-full p-1 text-slate-400 hover:text-slate-100"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
              className="rounded-full p-1 text-slate-400 hover:text-slate-100"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="flex-1 text-center text-xs font-semibold text-slate-200">
              {formatMonthYear(visibleMonth)}
            </span>
            <button
              type="button"
              onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
              disabled={visibleMonth >= `${today.slice(0, 7)}-01`}
              className="rounded-full p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 12))}
              disabled={visibleMonth >= `${today.slice(0, 7)}-01`}
              className="rounded-full p-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
            >
              <ChevronsRight size={14} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-0.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div
                key={index}
                className="py-1 text-center text-[10px] font-semibold text-slate-500"
              >
                {day}
              </div>
            ))}
            {days.map((day) => {
              const isFuture = day.iso > today;
              const isSelected = day.iso === selectedDate;
              const isToday = day.iso === today;

              return (
                <button
                  key={day.iso}
                  type="button"
                  disabled={isFuture || !day.inMonth}
                  onClick={() => {
                    onSelectDate(day.iso);
                    setOpen(false);
                  }}
                  className={`rounded-full py-1 text-center text-xs transition-colors ${
                    !day.inMonth
                      ? 'text-slate-700'
                      : isFuture
                        ? 'cursor-not-allowed text-slate-700'
                        : isSelected
                          ? 'bg-amber-300 font-semibold text-slate-950'
                          : isToday
                            ? 'border border-slate-600 text-slate-200 hover:bg-slate-800'
                            : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {day.dayNumber}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {getMonthName(visibleMonth)}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: 7 }, (_, offset) => addDays(today, -6 + offset)).map(
                  (date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        onSelectDate(date);
                        setOpen(false);
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        date === selectedDate
                          ? 'bg-amber-300 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {date === today
                        ? 'Today'
                        : new Intl.DateTimeFormat('en-IE', { weekday: 'short' }).format(
                            parseIsoDate(date),
                          )}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="mt-1">
            <button
              type="button"
              onClick={() => {
                onSelectDate(today);
                setOpen(false);
              }}
              className="w-full rounded-full border border-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-slate-100"
            >
              Back to Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function HistoricalDayScreen(props: HistoricalDayScreenProps) {
  const { initialLiveTime } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Per-day display state — initialized from SSR props, updated on cache hits.
  // ---------------------------------------------------------------------------
  const [dayData, setDayData] = useState<HistoricalDayPayload>(() => propsToPayload(props));

  // Re-sync from SSR props when the server provides a fresh date after a
  // cache-miss router.push() navigates to a new /history/[date] page.
  useEffect(() => {
    setDayData(propsToPayload(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selectedDate]);

  const {
    today,
    displayDate,
    selectedDate,
    timezone,
    screenState,
    health,
    hasTariff,
    minuteChartData,
    halfHourChartData,
    hourChartData,
    costChartData,
    dayTotals,
    financialEstimate,
  } = dayData;
  const chartPrefsStorageKey = useMemo(() => getChartPrefsStorageKey(timezone), [timezone]);
  const [resolution, setResolution] = useState<Resolution>('1min');
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [activeSeries, setActiveSeries] = useState<SeriesKey[]>(MINUTE_DEFAULT_SERIES);
  const [chartPrefsReady, setChartPrefsReady] = useState(false);

  const [warningDetailsOpen, setWarningDetailsOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [dismissedIncidentIds, setDismissedIncidentIds] = useState<string[]>([]);
  const [liveTime, setLiveTime] = useState(initialLiveTime);

  // Touch state for swipe navigation
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

  // Clock tick
  useEffect(() => {
    const updateClock = () => setLiveTime(formatClockTime(new Date(), timezone));
    updateClock();
    const clockIntervalId = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(clockIntervalId);
  }, [timezone]);

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

  // Touch swipe handlers
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
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

  // Last chart point for current solar share / grid draw (use last minute point)
  const lastPoint = baseChartData[baseChartData.length - 1];
  const currentSolarShare =
    lastPoint && lastPoint.consumption > 0
      ? Math.round(
          Math.min(100, Math.max(0, ((lastPoint.generation - lastPoint.export) / lastPoint.consumption) * 100)),
        )
      : lastPoint && lastPoint.generation > 0
        ? 100
        : 0;
  const currentGridDraw = 100 - currentSolarShare;

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)] font-sans text-slate-100"
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
      <header className="border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
              J
            </div>
          </div>
        </div>
      </header>

      <WarningBanner
        screenState={displayScreenState}
        health={displayHealth}
        onOpenDetails={() => {
          setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
          setWarningDetailsOpen(true);
        }}
      />

      {/* Control bar */}
      <div className="border-b border-slate-800 bg-[#0c1422]/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <TrustBadge
            screenState={displayScreenState}
            health={displayHealth}
            onOpenDetails={() => {
              setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
              setWarningDetailsOpen(true);
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {/* Prev day button */}
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={!canGoPrev}
              title="Previous day"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <DatePickerControl
              selectedDate={selectedDate}
              displayDate={displayDate}
              today={today}
              onSelectDate={navigateToDate}
            />

            {/* Next day button */}
            <button
              type="button"
              onClick={handleNextDay}
              title={isNextToday ? 'Go to live' : 'Next day'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <ChevronRight size={14} />
            </button>

            <span className="inline-flex min-w-[92px] justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              {liveTime}
            </span>
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
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Historical
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">{displayDate}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Full-day energy breakdown and financial interpretation for this date.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <DayTrendChart
              mode="historical"
              data={chartData}
              costData={valueChartData}
              screenState={displayScreenState}
              resolution={resolution}
              onResolutionChange={setResolution}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              activeSeries={activeSeries}
              onToggleSeries={toggleSeries}
            />

            <div className="space-y-4">
              <DayValuePanel
                mode="historical"
                hasTariff={hasTariff}
                estimate={financialEstimate}
              />
              <DayTotalsPanel
                mode="historical"
                totals={dayTotals}
                screenState={displayScreenState}
              />
              <SolarCoveragePanel
                mode="historical"
                chartData={baseChartData}
                currentSolarShare={currentSolarShare}
                overallSolarCoverage={overallSolarCoverage}
                currentGridDraw={currentGridDraw}
              />

              <HistoricalNotesPanel model={historicalNotes} />
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

function HistoricalNotesPanel({
  model,
}: {
  model: HistoricalNotesModel;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Notes
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">{model.heading}</h3>
      <p className="mt-2 text-sm text-slate-400">{model.summary}</p>
      <div className="mt-4 space-y-3">
        {model.notes.map((note) => {
          const toneClasses =
            note.tone === 'good'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50'
              : note.tone === 'caution'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-50'
                : 'border-slate-800 bg-slate-950/70 text-slate-100';

          return (
            <div key={note.title} className={`rounded-2xl border p-3 ${toneClasses}`}>
              <p className="font-semibold">{note.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{note.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
