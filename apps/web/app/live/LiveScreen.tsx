'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
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
  Sun,
  Sunrise,
  Sunset,
  TriangleAlert,
  WifiOff,
  Zap,
} from 'lucide-react';
import { SignedInHeader } from '@/src/components/SignedInHeader';
import type { LiveWeatherResult } from '@/src/weather/types';
import { getWmoInfo } from '@/src/weather/wmoCode';
import { formatDaylightStatus } from '@/src/weather/sunPosition';
import type { CurrentMetrics, FinancialEstimate, LivePoint, TariffContext } from '@/src/live/loader';
import { getTariffStateAt } from '@/src/live/tariffState';
import {
  buildLiveTrendIndicator,
  getLiveDayTotalsHeading,
  getMetricPolarity,
} from '@/src/live/dayCardModel';
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
  formatKw,
  formatKwh,
  formatW,
  formatEuro,
  parseIsoDate,
  addDays,
} from '@/src/live/chartUtils';
import {
  resolveLiveSwipeTarget,
  resolveNavigationTarget,
  shouldIgnoreSwipeTarget,
} from '@/src/live/swipeNavigation';
import type { CostPoint } from '@/src/live/loader';
import { buildRangeUrl } from '@/src/range/presets';
import { RangePickerPopover } from '@/src/components/RangePickerPopover';
import type { NavigationTarget } from '@/src/components/RangePickerPopover';
import { StaleTariffBanner } from '@/src/components/StaleTariffBanner';
import type { StaleTariffWarning } from '@/src/tariffs/stale-check';
import { LiveClockChip } from '@/src/components/LiveClockChip';
import * as dayCache from '@/src/live/dayCache';
import type { HistoricalDayPayload } from '@/app/api/history/[date]/route';

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
  tariffContext: TariffContext | null;
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
  repaymentCoverage: { amount: number; percent: number } | null;
  yesterdayRepaymentAmount: number | null;
  staleTariffWarning: StaleTariffWarning;
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

function sumUpToMinute<T extends { time: string }>(
  points: T[],
  cutoffMinute: string,
  getter: (point: T) => number,
): number {
  return Math.round(
    points
      .filter((point) => point.time <= cutoffMinute)
      .reduce((sum, point) => sum + getter(point), 0) * 100,
  ) / 100;
}

function getSunMarkerPhase(sunEvents: { sunriseUtc: string; solarNoonUtc: string; sunsetUtc: string } | null): number {
  if (!sunEvents) return 0;

  const now = Date.now();
  let phase = 0;
  if (new Date(sunEvents.sunriseUtc).getTime() <= now) phase += 1;
  if (new Date(sunEvents.solarNoonUtc).getTime() <= now) phase += 1;
  if (new Date(sunEvents.sunsetUtc).getTime() <= now) phase += 1;
  return phase;
}

// ---------------------------------------------------------------------------
// Sub-components (Live-screen-only, not shared with Historical Day)
// ---------------------------------------------------------------------------

function LiveNavBar({
  screenState,
  health,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: LiveScreenProps['health'];
  onOpenDetails?: () => void;
}) {
  return (
    <SignedInHeader
      left={
        <>
          <Link
            href="/live"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronLeft size={14} />
            <Home size={13} />
            <span className="hidden sm:inline">Overview</span>
          </Link>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-2">
            {screenState === 'healthy' ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-live-pulse" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-orange-400" />
            )}
            <span className="text-sm font-semibold text-slate-100">Live</span>
          </div>
        </>
      }
      actions={
        <>
          <TrustBadge screenState={screenState} health={health} onOpenDetails={onOpenDetails} />
          <Link
            href="/calendar"
            title="Calendar"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            <Calendar size={14} />
          </Link>
        </>
      }
    />
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
      href: undefined as string | undefined,
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <Clock size={15} className="mt-0.5 shrink-0" />,
    },
    warning: {
      title: 'A data gap needs review',
      body:
        health.primaryIncident?.message ??
        'A recent interval contains an unusual gap or missing live readings.',
      cta: 'Review details',
      href: undefined as string | undefined,
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <AlertTriangle size={15} className="mt-0.5 shrink-0" />,
    },
    disconnected: {
      title: 'Provider connection needs attention',
      body: 'Live telemetry has stopped. Reconnecting the provider is the next action.',
      cta: 'Reconnect provider',
      href: '/connect-provider' as string | undefined,
      className: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
      icon: <WifiOff size={15} className="mt-0.5 shrink-0" />,
    },
  }[screenState];

  const ctaClassName = 'text-xs font-semibold underline underline-offset-4';

  return (
    <div className={`border-b px-4 py-3 ${config.className}`}>
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        {config.icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{config.title}</p>
          <p className="mt-0.5 text-sm text-inherit/80">{config.body}</p>
        </div>
        {config.href ? (
          <Link href={config.href} className={ctaClassName}>
            {config.cta}
          </Link>
        ) : (
          <button
            type="button"
            onClick={screenState === 'warning' ? onOpenDetails : undefined}
            className={ctaClassName}
          >
            {config.cta}
          </button>
        )}
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

function TariffStateChip({
  tariffState,
}: {
  tariffState: { label: string; ratePerKwh: number; isFreeImport: boolean } | null;
}) {
  if (!tariffState) return null;

  const normalizedLabel = tariffState.label.trim() || 'Tariff';
  const text = tariffState.isFreeImport
    ? 'Free import now'
    : `${normalizedLabel} rate now`;
  const rate = tariffState.isFreeImport ? null : `${formatEuro(tariffState.ratePerKwh)}/kWh`;

  return (
    <Link
      href="/settings/tariffs"
      className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-cyan-100"
    >
      <span>{text}</span>
      {rate && <span className="font-mono text-cyan-100">{rate}</span>}
    </Link>
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

  const { label: daylightLabel, value: daylightValue } = formatDaylightStatus(sunPosition, sunEvents);

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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InfoTile
          icon={<Sunrise size={14} />}
          label="Sunrise"
          value={sunEvents ? formatSunTime(sunEvents.sunriseUtc, timezone) : '—'}
        />
        <InfoTile
          icon={<Sun size={14} />}
          label="Solar noon"
          value={sunEvents ? formatSunTime(sunEvents.solarNoonUtc, timezone) : '—'}
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
          label={daylightLabel}
          value={daylightValue}
        />
      </div>

      {weatherResult.status === 'forecast-unavailable' && (
        <p className="mt-3 text-xs text-slate-500">Weather forecast temporarily unavailable.</p>
      )}
    </div>
  );
}

function NearTermPanel({
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

  const { hourlyForecast } = weatherResult.data;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Near term
      </p>
      <h3 className="mt-1 text-base font-semibold text-slate-50">Next 12 hours</h3>
      <div
        className="mt-3 flex gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(51 65 85) transparent', touchAction: 'pan-x' }}
        data-swipe-ignore="true"
      >
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
  );
}

function OutlookPanel({ weatherResult }: { weatherResult: LiveWeatherResult }) {
  if (weatherResult.status !== 'ok') return null;
  const { dailyForecast } = weatherResult.data;
  return (
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
        <Link
          href="/connect-provider"
          className="rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Reconnect provider
        </Link>
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
  tariffContext,
  weatherResult,
  hasCapacity,
  currentMetrics,
  minuteChartData,
  halfHourChartData,
  hourChartData,
  costChartData,
  todayTotals,
  financialEstimate,
  repaymentCoverage,
  yesterdayRepaymentAmount,
  staleTariffWarning,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(initialLiveTime.slice(0, 5));
  const [yesterdayData, setYesterdayData] = useState<HistoricalDayPayload | null>(null);

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
  const liveSunEvents =
    weatherResult.status === 'no-location'
      ? null
      : weatherResult.status === 'ok'
        ? weatherResult.data.sunEvents
        : weatherResult.sunEvents;
  const sunMarkerPhase = useMemo(
    () => getSunMarkerPhase(liveSunEvents),
    [liveSunEvents, currentMinute],
  );
  const liveSunMarkers = useMemo(() => {
    if (weatherResult.status === 'no-location') {
      return { energy: [], cost: [] };
    }

    const sunEvents = liveSunEvents;
    if (!sunEvents) {
      return { energy: [], cost: [] };
    }

    const energyTimes = baseChartData.map((point) => point.time);
    const costTimes = valueChartData.map((point) => point.time);
    const markerSpecs = [
      { utcIso: sunEvents.sunriseUtc, label: 'Sunrise' },
      { utcIso: sunEvents.solarNoonUtc, label: 'Solar noon' },
      { utcIso: sunEvents.sunsetUtc, label: 'Sunset' },
    ].slice(0, sunMarkerPhase);

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
  }, [baseChartData, timezone, valueChartData, liveSunEvents, sunMarkerPhase, weatherResult.status]);
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

  useEffect(() => {
    const yesterday = addDays(today, -1);
    dayCache.prefetch(yesterday, today);
    const cached = dayCache.get(yesterday);
    if (!cached) return;

    let cancelled = false;
    cached
      .then((payload) => {
        if (!cancelled) {
          setYesterdayData(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setYesterdayData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [today]);

  const yesterdayComparable = useMemo(() => {
    if (!yesterdayData) return null;

    const generatedKwh = sumUpToMinute(
      yesterdayData.minuteChartData,
      currentMinute,
      (point) => point.generation * point.intervalHours,
    );
    const consumedKwh = sumUpToMinute(
      yesterdayData.minuteChartData,
      currentMinute,
      (point) => point.consumption * point.intervalHours,
    );
    const importKwh = sumUpToMinute(
      yesterdayData.minuteChartData,
      currentMinute,
      (point) => point.import * point.intervalHours,
    );
    const exportKwh = sumUpToMinute(
      yesterdayData.minuteChartData,
      currentMinute,
      (point) => point.export * point.intervalHours,
    );
    const immersionDivertedKwh = sumUpToMinute(
      yesterdayData.minuteChartData,
      currentMinute,
      (point) => point.immersion * point.intervalHours,
    );

    const importCost = sumUpToMinute(
      yesterdayData.costChartData,
      currentMinute,
      (point) => point.importCost,
    );
    const exportCredit = sumUpToMinute(
      yesterdayData.costChartData,
      currentMinute,
      (point) => point.exportCredit,
    );
    const solarSavings = sumUpToMinute(
      yesterdayData.costChartData,
      currentMinute,
      (point) => point.savings,
    );
    const netBillImpact = Math.round((importCost - exportCredit) * 100) / 100;
    const totalSolarValue = Math.round((solarSavings + exportCredit) * 100) / 100;
    const comparableRepaymentCoverage =
      yesterdayRepaymentAmount && yesterdayRepaymentAmount > 0
        ? Math.round((totalSolarValue / yesterdayRepaymentAmount) * 100)
        : null;

    // Overall solar coverage up to the same point in the day yesterday
    const yesterdayOverallCoverage =
      consumedKwh > 0
        ? Math.round(Math.min(100, Math.max(0, ((consumedKwh - importKwh) / consumedKwh) * 100)))
        : null;

    // Instantaneous solar share from yesterday at the current minute
    const currentPoint =
      yesterdayData.minuteChartData.find((p) => p.time === currentMinute) ??
      [...yesterdayData.minuteChartData].filter((p) => p.time <= currentMinute).slice(-1)[0] ??
      null;
    const yesterdayInstantSolarShare =
      currentPoint != null
        ? currentPoint.consumption > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((currentPoint.generation - currentPoint.export) / currentPoint.consumption) * 100,
                ),
              ),
            )
          : currentPoint.generation > 0
            ? 100
            : 0
        : null;

    return {
      totals: {
        generatedKwh,
        consumedKwh,
        importKwh,
        exportKwh,
        immersionDivertedKwh,
      },
      financialEstimate:
        yesterdayData.costChartData.length > 0
          ? {
              importCost,
              exportCredit,
              solarSavings,
              netBillImpact,
            }
          : null,
      totalSolarValue,
      repaymentCoveragePercent: comparableRepaymentCoverage,
      yesterdayOverallCoverage,
      yesterdayInstantSolarShare,
    };
  }, [currentMinute, yesterdayData, yesterdayRepaymentAmount]);

  const liveDayValueTrends = useMemo(() => ({
    import_cost: buildLiveTrendIndicator({
      current: financialEstimate?.importCost ?? null,
      previous: yesterdayComparable?.financialEstimate?.importCost ?? null,
      polarity: getMetricPolarity('import_cost'),
      formatter: (value) => formatEuro(value),
    }),
    export_credit: buildLiveTrendIndicator({
      current: financialEstimate?.exportCredit ?? null,
      previous: yesterdayComparable?.financialEstimate?.exportCredit ?? null,
      polarity: getMetricPolarity('export_credit'),
      formatter: (value) => formatEuro(value),
    }),
    onsite_solar_value: buildLiveTrendIndicator({
      current: financialEstimate?.solarSavings ?? null,
      previous: yesterdayComparable?.financialEstimate?.solarSavings ?? null,
      polarity: getMetricPolarity('self_consumed_value'),
      formatter: (value) => formatEuro(value),
    }),
    net_energy_bill: buildLiveTrendIndicator({
      current: financialEstimate?.netBillImpact ?? null,
      previous: yesterdayComparable?.financialEstimate?.netBillImpact ?? null,
      polarity: getMetricPolarity('net_energy_bill'),
      formatter: (value) => formatEuro(value),
    }),
    total_solar_value: buildLiveTrendIndicator({
      current:
        financialEstimate != null
          ? financialEstimate.solarSavings + financialEstimate.exportCredit
          : null,
      previous: yesterdayComparable?.totalSolarValue ?? null,
      polarity: getMetricPolarity('total_solar_value'),
      formatter: (value) => formatEuro(value),
    }),
    prorata_coverage: buildLiveTrendIndicator({
      current: repaymentCoverage?.percent ?? null,
      previous: yesterdayComparable?.repaymentCoveragePercent ?? null,
      polarity: getMetricPolarity('prorata_coverage'),
      formatter: (value) => `${Math.round(value)}%`,
    }),
  }), [financialEstimate, repaymentCoverage, yesterdayComparable]);

  const liveDayTotalTrends = useMemo(() => ({
    generation_kwh: buildLiveTrendIndicator({
      current: todayTotals?.generatedKwh ?? null,
      previous: yesterdayComparable?.totals.generatedKwh ?? null,
      polarity: getMetricPolarity('generation_kwh'),
      formatter: (value) => formatKwh(value),
    }),
    consumed_kwh: buildLiveTrendIndicator({
      current: todayTotals?.consumedKwh ?? null,
      previous: yesterdayComparable?.totals.consumedKwh ?? null,
      polarity: getMetricPolarity('consumed_kwh'),
      formatter: (value) => formatKwh(value),
    }),
    import_kwh: buildLiveTrendIndicator({
      current: todayTotals?.importKwh ?? null,
      previous: yesterdayComparable?.totals.importKwh ?? null,
      polarity: getMetricPolarity('import_kwh'),
      formatter: (value) => formatKwh(value),
    }),
    export_kwh: buildLiveTrendIndicator({
      current: todayTotals?.exportKwh ?? null,
      previous: yesterdayComparable?.totals.exportKwh ?? null,
      polarity: getMetricPolarity('export_kwh'),
      formatter: (value) => formatKwh(value),
    }),
    immersion_kwh: buildLiveTrendIndicator({
      current: todayTotals?.immersionDivertedKwh ?? null,
      previous: yesterdayComparable?.totals.immersionDivertedKwh ?? null,
      polarity: getMetricPolarity('immersion_kwh'),
      formatter: (value) => formatKwh(value),
    }),
  }), [todayTotals, yesterdayComparable]);

  const liveCoverageTrends = useMemo(() => ({
    current_solar_coverage: buildLiveTrendIndicator({
      current: currentMetrics?.solarShare ?? null,
      previous: yesterdayComparable?.yesterdayInstantSolarShare ?? null,
      polarity: 'higher-better',
      formatter: (v) => `${Math.round(v)}%`,
    }),
    overall_solar_coverage: buildLiveTrendIndicator({
      current: overallSolarCoverage,
      previous: yesterdayComparable?.yesterdayOverallCoverage ?? null,
      polarity: 'higher-better',
      formatter: (v) => `${Math.round(v)}%`,
    }),
    current_grid_draw: buildLiveTrendIndicator({
      current: currentMetrics?.gridShare ?? null,
      previous:
        yesterdayComparable?.yesterdayInstantSolarShare != null
          ? 100 - yesterdayComparable.yesterdayInstantSolarShare
          : null,
      polarity: 'lower-better',
      formatter: (v) => `${Math.round(v)}%`,
    }),
  }), [currentMetrics, overallSolarCoverage, yesterdayComparable]);

  const liveDayTotalsHeading = useMemo(
    () => getLiveDayTotalsHeading(liveSunEvents, new Date()),
    [liveSunEvents, currentMinute],
  );

  const currentTariffState = useMemo(() => {
    if (!tariffContext) return null;
    return getTariffStateAt(tariffContext, selectedDate, currentMinute);
  }, [currentMinute, selectedDate, tariffContext]);

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

  // Keep time-based chart markers current without re-rendering the whole page every second.
  useEffect(() => {
    const updateMinute = () =>
      setCurrentMinute(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date()),
      );

    updateMinute();

    const now = new Date();
    const delayMs = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      updateMinute();
      intervalId = window.setInterval(updateMinute, 60_000);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
    };
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

  function handlePickerNavigate(target: NavigationTarget) {
    setPickerOpen(false);
    if (target.type === 'live') return; // already here
    if (target.type === 'history') {
      startTransition(() => router.push(`/history/${target.date}`));
    } else {
      startTransition(() => router.push(buildRangeUrl(target.range)));
    }
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
    const target = resolveLiveSwipeTarget(deltaX, deltaY, today);
    if (!target) return;
    startTransition(() => {
      router.push(target);
    });
  }

  function handleTouchCancel() {
    if (!SWIPE_NAVIGATION_ENABLED) return;
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const isStale = displayScreenState === 'stale' || displayScreenState === 'warning';
  const isDisconnected = displayScreenState === 'disconnected';

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
      <LiveNavBar
        screenState={displayScreenState}
        health={displayHealth}
        onOpenDetails={() => {
          setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
          setWarningDetailsOpen(true);
        }}
      />
      <WarningBanner
        screenState={displayScreenState}
        health={displayHealth}
        onOpenDetails={() => {
          setSelectedIncidentId(primaryActiveIncident?.id ?? health.primaryIncident?.id ?? null);
          setWarningDetailsOpen(true);
        }}
      />

      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          <div className="flex flex-1 items-center">
            <TariffStateChip tariffState={currentTariffState} />
          </div>

          {/* Center: date navigation */}
          <div className="relative flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => navigateToDate(yesterday)}
              title="Previous day"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-slate-100 transition-colors"
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

            {/* Invisible spacer to balance the left chevron */}
            <div className="h-7 w-7" aria-hidden="true" />

            {pickerOpen && (
              <RangePickerPopover
                today={today}
                earliestDate={null}
                activeRange={null}
                activeDate={today}
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
        <StaleTariffBanner warning={staleTariffWarning} />
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
                description=""
              />

              <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <DayTrendChart
                  mode="live"
                  data={chartData}
                  costData={valueChartData}
                  sunMarkers={liveSunMarkers}
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
                    repaymentCoverage={repaymentCoverage}
                    trends={liveDayValueTrends}
                  />
                  <DayTotalsPanel
                    mode="live"
                    totals={todayTotals}
                    screenState={displayScreenState}
                    selectedDate={selectedDate}
                    trends={liveDayTotalTrends}
                    liveHeading={liveDayTotalsHeading}
                  />
                  <SolarCoveragePanel
                    mode="live"
                    chartData={baseChartData}
                    sunMarkers={liveSunMarkers.energy}
                    currentSolarShare={currentMetrics?.solarShare ?? 0}
                    overallSolarCoverage={overallSolarCoverage}
                    currentGridDraw={currentMetrics?.gridShare ?? 100}
                    trends={liveCoverageTrends}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                eyebrow="Next"
                title="What is likely to happen over the next few hours"
                description=""
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <NearTermPanel weatherResult={weatherResult} timezone={timezone} />
                <OutlookPanel weatherResult={weatherResult} />
                <div className="xl:sticky xl:top-20 xl:self-start">
                  <SolarContextPanel weatherResult={weatherResult} timezone={timezone} />
                </div>
                <NotesPanel
                  screenState={screenState}
                  hasTariff={hasTariff}
                  hasCoordinates={hasCoordinates}
                />
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
