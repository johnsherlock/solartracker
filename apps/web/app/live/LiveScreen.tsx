'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Home,
  Moon,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  TriangleAlert,
  WifiOff,
  Zap,
} from 'lucide-react';
import type { LiveWeatherResult } from '@/src/weather/types';
import { getWmoInfo } from '@/src/weather/wmoCode';
import { formatDaylightRemaining } from '@/src/weather/sunPosition';
import type { CurrentMetrics, FinancialEstimate, LivePoint } from '@/src/live/loader';
import {
  DayTrendChart,
  DayValuePanel,
  DayTotalsPanel,
  SolarCoveragePanel,
  ToggleGroup,
} from './DayAnalysis';
import {
  type Resolution,
  type ViewMode,
  type SeriesKey,
  SERIES_ORDER,
  MINUTE_DEFAULT_SERIES,
  applyViewMode,
  applyCostViewMode,
  formatClockTime,
  formatKw,
  formatW,
  formatEuro,
  parseIsoDate,
  addDays,
  startOfMonth,
  shiftMonth,
  formatMonthYear,
  getMonthName,
  getMonthDays,
} from '@/src/live/chartUtils';
import {
  resolveLiveSwipeTarget,
  resolveNavigationTarget,
  shouldIgnoreSwipeTarget,
} from '@/src/live/swipeNavigation';
import type { CostPoint } from '@/src/live/loader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

export type LiveScreenProps = {
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
  weatherResult: LiveWeatherResult;
  hasCapacity: boolean;
  currentMetrics: CurrentMetrics | null;
  minuteChartData: LivePoint[];
  halfHourChartData: LivePoint[];
  hourChartData: LivePoint[];
  costChartData: CostPoint[];
  todayTotals: {
    generatedKwh: number;
    consumedKwh: number;
    importKwh: number;
    exportKwh: number;
    immersionDivertedKwh: number;
  } | null;
  financialEstimate: FinancialEstimate | null;
};

// ---------------------------------------------------------------------------
// Utilities (live-screen-specific, not shared with Historical Day)
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const ratio = clamp(t, 0, 1);
  const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio));
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

function getUptimeTone(uptimePercent: number): { border: string; background: string; text: string } {
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

function buildLiveUrl(pathname: string, date: string, today: string): string {
  return date === today ? pathname : `${pathname}?date=${date}`;
}

// ---------------------------------------------------------------------------
// Sub-components (Live-screen-only, not shared with Historical Day)
// ---------------------------------------------------------------------------

function CapabilityBar({
  hasTariff,
  hasCoordinates,
  hasCapacity,
}: {
  hasTariff: boolean;
  hasCoordinates: boolean;
  hasCapacity: boolean;
}) {
  const items = [
    { key: 'tariff', label: 'Tariff linked', active: hasTariff },
    { key: 'coordinates', label: 'Coordinates added', active: hasCoordinates },
    { key: 'capacity', label: 'Array capacity known', active: hasCapacity },
  ];

  return (
    <div className="hidden sm:block border-b border-slate-800 bg-[#08111f] px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Setup
        </span>
        {items.map((item) => (
          <span
            key={item.key}
            className={`rounded-full border px-3 py-1 font-medium ${
              item.active
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 text-slate-500'
            }`}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function NavBar({ screenState }: { screenState: ScreenState }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ChevronLeft size={14} />
            <Home size={13} />
            <span className="hidden sm:inline">Overview</span>
          </div>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            {screenState === 'healthy' ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-live-pulse" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-orange-400" />
            )}
            <span className="text-sm font-semibold text-slate-100">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {screenState === 'healthy' && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
              <RefreshCw size={11} className="text-emerald-400" />
              Auto-refreshing
            </span>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
            J
          </div>
        </div>
      </div>
    </header>
  );
}

function TrustBadge({
  screenState,
  health,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: LiveScreenProps['health'];
  onOpenDetails?: () => void;
}) {
  function label(): string {
    switch (screenState) {
      case 'healthy':
        return `Updated ${health.refreshedAtLocalTime}`;
      case 'stale':
        return health.lastReadingLocalTime
          ? `Last reading ${health.lastReadingLocalTime}`
          : 'Data delayed';
      case 'warning':
        return 'Data quality review needed';
      case 'disconnected':
        return 'Provider disconnected';
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
  health: LiveScreenProps['health'];
  onOpenDetails?: () => void;
}) {
  if (screenState === 'healthy') return null;

  const config = {
    stale: {
      title: 'Live data is delayed',
      body: 'Last-known values are still useful for context, but they may no longer reflect the current home state.',
      cta: 'Review Data Health',
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <Clock size={15} className="mt-0.5 shrink-0" />,
    },
    warning: {
      title: 'A data gap needs review',
      body:
        health.primaryIncident?.message ??
        'A recent interval contains an unusual gap or missing live readings.',
      cta: 'Review details',
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <AlertTriangle size={15} className="mt-0.5 shrink-0" />,
    },
    disconnected: {
      title: 'Provider connection needs attention',
      body: 'Live telemetry has stopped. Reconnecting the provider is the next action.',
      cta: 'Reconnect provider',
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
  health: LiveScreenProps['health'];
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
            ? `${health.incidents.length} outage${health.incidents.length === 1 ? '' : 's'} detected today`
            : 'Data quality overview'}
        </h3>
        <p className="mt-3 text-sm text-slate-300">
          Based on expected provider minute coverage
          {health.expectedMinutes > 0 ? ` so far today.` : '.'}
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

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-50">{title}</h2>
        <p className="hidden sm:block mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MobileMetricGrid({
  current,
  stale,
}: {
  current: CurrentMetrics;
  stale?: boolean;
}) {
  const items = [
    { label: 'Gen', value: current.generatedKw.toFixed(2), unit: 'kW', tone: 'text-amber-300' },
    { label: 'Use', value: current.consumedKw.toFixed(2), unit: 'kW', tone: 'text-slate-100' },
    { label: 'Imp', value: current.importKw.toFixed(2), unit: 'kW', tone: 'text-slate-300' },
    { label: 'Exp', value: current.exportKw.toFixed(2), unit: 'kW', tone: 'text-emerald-300' },
  ];

  return (
    <div className={`grid grid-cols-2 gap-2 md:hidden ${stale ? 'opacity-90' : ''}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2.5"
        >
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.label}
              </p>
              <p className={`mt-1 font-mono text-2xl font-semibold ${item.tone}`}>{item.value}</p>
            </div>
            <span className="pb-1 text-[11px] text-slate-500">{item.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  caption,
  icon,
  accentClass,
  stale,
}: {
  label: string;
  value: string;
  unit: string;
  caption: string;
  icon: ReactNode;
  accentClass: string;
  stale?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-slate-900/75 p-4 shadow-[0_24px_50px_rgba(2,6,23,0.28)] transition-colors ${
        stale ? 'border-orange-500/25' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        <span className={accentClass}>{icon}</span>
      </div>
      <div className="mt-4 flex items-end gap-1.5">
        <span
          className={`font-mono text-4xl font-semibold tracking-tight ${stale ? 'text-slate-300' : 'text-slate-50'}`}
        >
          {value}
        </span>
        <span className="mb-1 text-sm text-slate-500">{unit}</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{caption}</p>
    </div>
  );
}

function InsightStrip({
  current,
  arrayCapacityKw,
  hasCapacity,
  stale,
}: {
  current: CurrentMetrics;
  arrayCapacityKw: number | null;
  hasCapacity: boolean;
  stale?: boolean;
}) {
  const { solarShare, gridShare, importKw, exportKw, generatedKw } = current;
  const generationVsCapacity =
    arrayCapacityKw && arrayCapacityKw > 0
      ? Math.min(100, Math.round((generatedKw / arrayCapacityKw) * 100))
      : null;

  const netPositionLabel =
    exportKw > 0 ? 'Surplus' : importKw < generatedKw * 0.1 ? 'Self-sufficient' : 'Grid assisted';
  const gridPressureLabel =
    solarShare > 80 ? 'Low' : solarShare > 50 ? 'Moderate' : 'High';

  return (
    <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
      <div
        className={`rounded-2xl border bg-[#101826] p-4 ${
          stale ? 'border-orange-500/25' : 'border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Right now
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-100 sm:text-lg">
              {solarShare > 0
                ? `${solarShare}% of home demand is being covered by solar`
                : 'No solar generation right now'}
            </h3>
          </div>
          {exportKw > 0 && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 sm:text-xs">
              Covering home + exporting {formatKw(exportKw)}
            </span>
          )}
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-300"
            style={{ width: `${Math.min(100, solarShare)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Solar share</span>
          <span>Grid reliance</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#101826] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Live interpretation
        </p>
        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Net position</span>
            <span
              className={`font-semibold ${exportKw > 0 ? 'text-emerald-300' : 'text-slate-200'}`}
            >
              {netPositionLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Grid draw pressure</span>
            <span className="font-semibold text-slate-200">{gridPressureLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Current gen vs capacity</span>
            <span className="font-semibold text-slate-200">
              {generationVsCapacity !== null ? `${generationVsCapacity}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
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

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weather helpers
// ---------------------------------------------------------------------------

const WMO_ICON_COMPONENT_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sun, Cloud, CloudSun, CloudMoon, Cloudy, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Moon,
};

function WmoIcon({ code, isDay, size = 16 }: { code: number; isDay: boolean; size?: number }) {
  const info = getWmoInfo(code);
  const iconName = isDay ? info.dayIcon : info.nightIcon;
  const IconComponent = WMO_ICON_COMPONENT_MAP[iconName] ?? Cloud;
  return <IconComponent size={size} />;
}

function formatSunTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcIso));
}

function formatHourLabel(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcIso));
}

function formatDayLabel(localDate: string): string {
  return new Intl.DateTimeFormat('en-IE', { weekday: 'short' }).format(
    new Date(`${localDate}T12:00:00`),
  );
}

function SolarContextPanel({
  weatherResult,
  timezone,
}: {
  weatherResult: LiveWeatherResult;
  timezone: string;
}) {
  if (weatherResult.status === 'no-location') {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Next
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Add coordinates to unlock solar context
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Sunrise, sunset, daylight remaining, and sun-position cues can all live here without
          needing full roof modeling.
        </p>
      </div>
    );
  }

  const sunEvents =
    weatherResult.status === 'ok' ? weatherResult.data.sunEvents : weatherResult.sunEvents;
  const sunPosition =
    weatherResult.status === 'ok' ? weatherResult.data.sunPosition : weatherResult.sunPosition;
  const location = weatherResult.status === 'ok' ? weatherResult.data.location : null;

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Next
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Solar context</h3>
          {location && (
            <p className="mt-0.5 text-xs text-slate-500">
              {location.precisionMode === 'approximate'
                ? `Approximate — ${location.displayName}`
                : location.displayName}
            </p>
          )}
        </div>
        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 p-2 text-amber-300">
          <Sun size={18} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={<Sunrise size={14} />}
          label="Sunrise"
          value={sunEvents ? formatSunTime(sunEvents.sunriseUtc, timezone) : '—'}
        />
        <InfoTile
          icon={<Sunset size={14} />}
          label="Sunset"
          value={sunEvents ? formatSunTime(sunEvents.sunsetUtc, timezone) : '—'}
        />
        <InfoTile
          icon={<Sun size={14} />}
          label="Sun altitude"
          value={
            sunPosition.isAboveHorizon ? `${sunPosition.elevationDegrees}°` : 'Below horizon'
          }
        />
        <InfoTile
          icon={<Activity size={14} />}
          label="Daylight left"
          value={formatDaylightRemaining(sunPosition.daylightRemainingSeconds)}
        />
      </div>

      {weatherResult.status === 'forecast-unavailable' && (
        <p className="mt-3 text-xs text-slate-500">Weather forecast temporarily unavailable.</p>
      )}
    </div>
  );
}

function ForecastPanel({
  weatherResult,
  timezone,
}: {
  weatherResult: LiveWeatherResult;
  timezone: string;
}) {
  if (weatherResult.status === 'no-location') {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Near term
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Forecast held back until site context exists
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Weather alone can be shown later, but the more useful version combines it with daylight
          timing and expected solar window.
        </p>
      </div>
    );
  }

  if (weatherResult.status === 'forecast-unavailable') {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Near term
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Forecast temporarily unavailable
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          The weather API could not be reached. Solar context is still shown where available.
        </p>
      </div>
    );
  }

  const { hourlyForecast, dailyForecast } = weatherResult.data;

  return (
    <div className="space-y-4">
      {/* 12-hour scrollable rail */}
      <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Near term
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-50">Next 12 hours</h3>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {hourlyForecast.slots.map((slot) => (
            <div
              key={slot.hourUtc}
              className="flex min-w-[60px] flex-col items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/70 px-2 py-2.5"
            >
              <span className="text-[10px] text-slate-400">{formatHourLabel(slot.hourUtc, timezone)}</span>
              <span className="text-amber-300">
                <WmoIcon code={slot.weatherCode} isDay={slot.isDay} size={16} />
              </span>
              <span className="text-sm font-semibold text-slate-100">{slot.temperatureCelsius}°</span>
              {slot.precipitationMm > 0 && (
                <span className="text-[10px] text-blue-300">{slot.precipitationMm}mm</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5-day outlook */}
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <h3 className="text-base font-semibold text-slate-50">5-day outlook</h3>
        <div className="mt-3 space-y-2">
          {dailyForecast.days.map((day, i) => (
            <div
              key={day.localDate}
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-sm"
            >
              <span className="w-10 shrink-0 text-slate-300 font-medium">
                {i === 0 ? 'Today' : formatDayLabel(day.localDate)}
              </span>
              <span className="text-amber-300 shrink-0">
                <WmoIcon code={day.weatherCode} isDay={true} size={15} />
              </span>
              <span className="flex-1 text-xs text-slate-500 truncate">
                {getWmoInfo(day.weatherCode).label}
              </span>
              {day.precipitationSumMm > 0 && (
                <span className="text-[10px] text-blue-300 shrink-0">{day.precipitationSumMm}mm</span>
              )}
              <div className="flex items-center gap-1.5 font-mono shrink-0">
                <span className="text-slate-100">{day.temperatureMaxCelsius}°</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-500">{day.temperatureMinCelsius}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoTile({
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

function NotesPanel({
  screenState,
  hasTariff,
  hasCoordinates,
}: {
  screenState: ScreenState;
  hasTariff: boolean;
  hasCoordinates: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Notes
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Trust and interpretation</h3>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="font-semibold text-slate-100">Capability gating</p>
          <p className="mt-1 text-slate-400">
            {hasTariff
              ? 'Tariff data is present, so live value is shown as a simplified daily-rate estimate.'
              : 'Tariff data is missing, so value stays as a prompt card while live energy remains fully useful.'}
          </p>
          <p className="mt-1 text-slate-400">
            {hasCoordinates
              ? 'Coordinates allow daylight and sun-position context.'
              : 'Coordinates are absent, so solar-context modules show setup prompts instead.'}
          </p>
        </div>
        {(screenState === 'stale' || screenState === 'warning') && (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-100">
            <p className="font-semibold">
              {screenState === 'stale' ? 'Stale data' : 'Suspicious data'}
            </p>
            <p className="mt-1 text-orange-100/80">
              Warnings stay calm and actionable; the page preserves context without quietly hiding
              uncertainty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DisconnectedState() {
  return (
    <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
        <WifiOff size={22} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-50">Live feed unavailable</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
        No data was returned from the provider for today. This may be a temporary outage or a
        configuration issue. The page will show live data once the provider feed resumes.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button className="rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950">
          Reconnect provider
        </button>
        <button className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
          Review Data Health
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function LiveScreen({
  today,
  displayDate,
  initialLiveTime,
  selectedDate,
  installationContext,
  timezone,
  screenState,
  health,
  hasTariff,
  weatherResult,
  hasCapacity,
  currentMetrics,
  minuteChartData,
  halfHourChartData,
  hourChartData,
  costChartData,
  todayTotals,
  financialEstimate,
}: LiveScreenProps) {
  const hasCoordinates = weatherResult.status !== 'no-location';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
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
    todayTotals && todayTotals.consumedKwh > 0
      ? Math.round(
          Math.min(
            100,
            Math.max(
              0,
              ((todayTotals.consumedKwh - todayTotals.importKwh) / todayTotals.consumedKwh) * 100,
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
    screenState === 'warning' && !primaryActiveIncident
      ? (health.minutesStale ?? 0) > 30
        ? 'stale'
        : 'healthy'
      : screenState;

  const displayHealth = useMemo(
    () => ({
      ...health,
      incidents: health.incidents,
      primaryIncident: primaryActiveIncident,
    }),
    [health, primaryActiveIncident],
  );

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
        JSON.stringify({
          resolution,
          viewMode,
          activeSeries,
        }),
      );
    } catch {
      // Ignore storage failures and keep the UI functional in-memory.
    }
  }, [activeSeries, chartPrefsReady, chartPrefsStorageKey, resolution, viewMode]);

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
      // Ignore storage failures and fall back to in-memory state.
    }
  }, [dismissalStorageKey, dismissedIncidentIds, health.incidents]);

  // Clock ticks independently of whether the user is on Live or Historical Day.
  useEffect(() => {
    const updateClock = () => setLiveTime(formatClockTime(new Date(), timezone));
    updateClock();
    const clockIntervalId = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(clockIntervalId);
  }, [timezone]);

  // Auto-refresh every few minutes to keep the live view current.
  useEffect(() => {

    let refreshTimeoutId: number | null = null;

    const clearRefreshTimer = () => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    };

    const scheduleRefresh = () => {
      clearRefreshTimer();
      if (document.visibilityState !== 'visible') return;
      refreshTimeoutId = window.setTimeout(() => {
        router.refresh();
        scheduleRefresh();
      }, 60_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        scheduleRefresh();
      } else {
        clearRefreshTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleRefresh();

    return () => {
      clearRefreshTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, timezone]);

  function navigateToDate(date: string) {
    startTransition(() => {
      router.push(resolveNavigationTarget(date, today));
    });
  }

  function toggleSeries(series: SeriesKey) {
    setActiveSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1 ? current : current.filter((item) => item !== series);
      }
      return [...current, series];
    });
  }

  const yesterday = addDays(today, -1);

  // Touch swipe handlers — swipe right navigates to yesterday
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
    const target = resolveLiveSwipeTarget(deltaX, deltaY, today);
    if (!target) return;
    startTransition(() => {
      router.push(target);
    });
  }

  function handleTouchCancel() {
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const isStale = displayScreenState === 'stale' || displayScreenState === 'warning';
  const isDisconnected = displayScreenState === 'disconnected';

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
      <CapabilityBar
        hasTariff={hasTariff}
        hasCoordinates={hasCoordinates}
        hasCapacity={hasCapacity}
      />
      <NavBar screenState={displayScreenState} />
      <WarningBanner
        screenState={displayScreenState}
        health={displayHealth}
        onOpenDetails={() => {
          setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
          setWarningDetailsOpen(true);
        }}
      />

      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <TrustBadge
            screenState={displayScreenState}
            health={displayHealth}
            onOpenDetails={() => {
              setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
              setWarningDetailsOpen(true);
            }}
          />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {/* Prev day — navigates to yesterday's history */}
            <button
              type="button"
              onClick={() => navigateToDate(yesterday)}
              title="Previous day"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            <DatePickerControl
              selectedDate={selectedDate}
              displayDate={displayDate}
              today={today}
              onSelectDate={navigateToDate}
            />

            {/* Next day — disabled on Live (already on today) */}
            <button
              type="button"
              disabled
              title="Already on today"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 opacity-30 cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>

            <span className="hidden sm:inline-flex min-w-[92px] justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              {liveTime}
            </span>
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
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Now"
            title="What the system is doing right now"
            description="Current power, freshness, and a quick read of whether solar is carrying the home."
          />

          {isDisconnected ? (
            <DisconnectedState />
          ) : (
            currentMetrics && (
              <>
                <MobileMetricGrid current={currentMetrics} stale={isStale} />

                <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Generation"
                    value={formatW(currentMetrics.generatedKw)}
                    unit="W"
                    caption="from panels"
                    icon={<Zap size={16} />}
                    accentClass="text-amber-300"
                    stale={isStale}
                  />
                  <MetricCard
                    label="Consumption"
                    value={formatW(currentMetrics.consumedKw)}
                    unit="W"
                    caption="home using now"
                    icon={<Home size={16} />}
                    accentClass="text-slate-300"
                    stale={isStale}
                  />
                  <MetricCard
                    label="Import"
                    value={formatW(currentMetrics.importKw)}
                    unit="W"
                    caption="from grid"
                    icon={<ArrowDownToLine size={16} />}
                    accentClass="text-slate-400"
                    stale={isStale}
                  />
                  <MetricCard
                    label="Export"
                    value={formatW(currentMetrics.exportKw)}
                    unit="W"
                    caption="to grid"
                    icon={<ArrowUpFromLine size={16} />}
                    accentClass="text-emerald-300"
                    stale={isStale}
                  />
                </div>

                <InsightStrip
                  current={currentMetrics}
                  arrayCapacityKw={installationContext?.arrayCapacityKw ?? null}
                  hasCapacity={hasCapacity}
                  stale={isStale}
                />
              </>
            )
          )}
        </section>

        {!isDisconnected && (
          <>
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Today"
                title="What today has meant so far"
                description="Live trend, same-day totals, and financial interpretation without turning the page into a billing dashboard."
              />

              <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <DayTrendChart
                  mode="live"
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
                    mode="live"
                    hasTariff={hasTariff}
                    estimate={financialEstimate}
                  />
                  <DayTotalsPanel
                    mode="live"
                    totals={todayTotals}
                    screenState={displayScreenState}
                  />
                  <SolarCoveragePanel
                    mode="live"
                    chartData={baseChartData}
                    currentSolarShare={currentMetrics?.solarShare ?? 0}
                    overallSolarCoverage={overallSolarCoverage}
                    currentGridDraw={currentMetrics?.gridShare ?? 100}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                eyebrow="Next"
                title="What is likely to happen over the next few hours"
                description="Daylight, weather, and near-term solar context — unlocked once coordinates are added."
              />

              <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                <div className="xl:sticky xl:top-20 xl:self-start">
                  <SolarContextPanel weatherResult={weatherResult} timezone={timezone} />
                </div>
                <div className="min-w-0 space-y-4">
                  <ForecastPanel weatherResult={weatherResult} timezone={timezone} />
                  <NotesPanel
                    screenState={screenState}
                    hasTariff={hasTariff}
                    hasCoordinates={hasCoordinates}
                  />
                </div>
              </div>
            </section>
          </>
        )}
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
