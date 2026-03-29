'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from 'recharts';
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
  Eye,
  EyeOff,
  Home,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  TriangleAlert,
  WifiOff,
  Wind,
  Zap,
} from 'lucide-react';
import type {
  CostPoint,
  CurrentMetrics,
  FinancialEstimate,
  LivePoint,
} from '@/src/live/loader';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';
type Resolution = '1min' | '30min' | '1hour';
type ViewMode = 'line' | 'cumulative';
type SeriesKey = 'generation' | 'consumption' | 'import' | 'export' | 'immersion';

export type LiveScreenProps = {
  today: string;
  displayDate: string;
  initialLiveTime: string;
  selectedDate: string;
  isHistoricalDate: boolean;
  installationContext: { name: string } | null;
  timezone: string;
  screenState: ScreenState;
  health: {
    minutesStale: number | null;
    lastReadingLocalTime: string | null;
    refreshedAtLocalTime: string;
    warningDetails: {
      kind: 'missing-interval';
      missingMinutes: number;
      gapStartsAt: string;
      gapEndsAt: string;
      message: string;
    } | null;
  };
  hasTariff: boolean;
  hasCoordinates: boolean;
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
// Constants
// ---------------------------------------------------------------------------

const SERIES_ORDER: SeriesKey[] = ['generation', 'consumption', 'import', 'immersion', 'export'];
const MINUTE_DEFAULT_SERIES: SeriesKey[] = ['generation', 'consumption'];
const SERIES_COLORS: Record<SeriesKey, string> = {
  generation: '#fbbf24',
  consumption: '#f97316',
  import: '#64748b',
  export: '#34d399',
  immersion: '#ef4444',
};
const COST_SERIES_ORDER = ['importCost', 'savings', 'exportCredit'] as const;
type CostSeriesKey = (typeof COST_SERIES_ORDER)[number];
const COST_SERIES_COLORS: Record<CostSeriesKey, string> = {
  importCost: '#f472b6',
  savings: '#4ade80',
  exportCredit: '#60a5fa',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function applyViewMode(data: LivePoint[], viewMode: ViewMode, resolution: Resolution): LivePoint[] {
  if (viewMode === 'line') return data;

  const running = { generation: 0, consumption: 0, import: 0, export: 0, immersion: 0 };
  return data.map((point) => {
    const factor = resolution === '1min' ? 1 : point.intervalHours;
    running.generation += point.generation * factor;
    running.consumption += point.consumption * factor;
    running.import += point.import * factor;
    running.export += point.export * factor;
    running.immersion += point.immersion * factor;
    return {
      time: point.time,
      generation: Number(running.generation.toFixed(2)),
      consumption: Number(running.consumption.toFixed(2)),
      import: Number(running.import.toFixed(2)),
      export: Number(running.export.toFixed(2)),
      immersion: Number(running.immersion.toFixed(2)),
      intervalHours: point.intervalHours,
    };
  });
}

function applyCostViewMode(data: CostPoint[], viewMode: ViewMode): CostPoint[] {
  if (viewMode === 'line') return data;

  const running = { importCost: 0, savings: 0, exportCredit: 0 };
  return data.map((point) => {
    running.importCost += point.importCost;
    running.savings += point.savings;
    running.exportCredit += point.exportCredit;
    return {
      time: point.time,
      importCost: Number(running.importCost.toFixed(2)),
      savings: Number(running.savings.toFixed(2)),
      exportCredit: Number(running.exportCredit.toFixed(2)),
    };
  });
}

function formatSeriesLabel(key: SeriesKey) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatCostSeriesLabel(key: CostSeriesKey) {
  if (key === 'importCost') return 'Import €';
  if (key === 'exportCredit') return 'Export €';
  return 'Savings €';
}

function formatResolutionLabel(value: Resolution) {
  if (value === '1min') return '1min';
  if (value === '30min') return '30min';
  return '1hour';
}

function formatKw(value: number) {
  return `${value.toFixed(2)} kW`;
}

function formatW(kw: number): string {
  return Math.round(kw * 1000).toLocaleString();
}

function formatKwh(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

function formatEuro(value: number, preserveSign = false): string {
  const sign = preserveSign && value < 0 ? '-' : '';
  return `${sign}€${Math.abs(value).toFixed(2)}`;
}

function formatEuroTick(value: number): string {
  if (value === 0) return '€0';
  return `€${value.toFixed(2)}`;
}

function formatClockTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(isoDate: string): Date {
  const date = parseIsoDate(isoDate);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function shiftMonth(isoDate: string, months: number): string {
  const date = startOfMonth(isoDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function formatMonthYear(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDate(isoDate));
}

function getMonthName(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IE', { month: 'long' }).format(parseIsoDate(isoDate));
}

function getMonthDays(visibleMonth: string) {
  const monthStart = startOfMonth(visibleMonth);
  const month = monthStart.getMonth();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      iso: date.toISOString().slice(0, 10),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

function buildLiveUrl(pathname: string, date: string, today: string): string {
  return date === today ? pathname : `${pathname}?date=${date}`;
}

// ---------------------------------------------------------------------------
// Sub-components
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
    <div className="border-b border-slate-800 bg-[#08111f] px-4 py-2 text-xs">
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
    <header className="border-b border-slate-800 bg-[#101826]">
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
  dismissed,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: LiveScreenProps['health'];
  dismissed?: boolean;
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
        return dismissed ? 'Data quality note dismissed' : 'Data quality review needed';
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
  dismissed,
  onOpenDetails,
}: {
  screenState: ScreenState;
  health: LiveScreenProps['health'];
  dismissed?: boolean;
  onOpenDetails?: () => void;
}) {
  if (screenState === 'warning' && dismissed) return null;
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
        health.warningDetails?.message ??
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
  onClose,
  onDismiss,
}: {
  health: LiveScreenProps['health'];
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
}) {
  if (!open || !health.warningDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
      <div className="w-full max-w-md rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Data quality
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">Missing live readings detected</h3>
        <p className="mt-3 text-sm text-slate-300">{health.warningDetails.message}</p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Gap window</span>
            <span className="font-mono">
              {health.warningDetails.gapStartsAt} to {health.warningDetails.gapEndsAt}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-slate-400">Missing minutes</span>
            <span className="font-mono">{health.warningDetails.missingMinutes}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          This note is based on missing minute records in the provider feed. If you trust the data,
          you can dismiss the warning for this session.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Dismiss warning
          </button>
        </div>
      </div>
    </div>
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
        <p className="mt-1 text-sm text-slate-400">{description}</p>
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
        <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
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
        <span className={`font-mono text-4xl font-semibold tracking-tight ${stale ? 'text-slate-300' : 'text-slate-50'}`}>
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
  hasCapacity,
  stale,
}: {
  current: CurrentMetrics;
  hasCapacity: boolean;
  stale?: boolean;
}) {
  const { solarShare, gridShare, importKw, exportKw, generatedKw } = current;

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
            <span className={`font-semibold ${exportKw > 0 ? 'text-emerald-300' : 'text-slate-200'}`}>
              {netPositionLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Grid draw pressure</span>
            <span className="font-semibold text-slate-200">{gridPressureLabel}</span>
          </div>
          {hasCapacity && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Grid draw</span>
              <span className="font-semibold text-cyan-300">{gridShare}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  renderLabel?: (value: T) => string;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 p-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === option
              ? 'bg-slate-100 text-slate-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {renderLabel ? renderLabel(option) : option}
        </button>
      ))}
    </div>
  );
}

function DatePickerControl({
  selectedDate,
  displayDate,
  today,
  isHistoricalDate,
  onSelectDate,
}: {
  selectedDate: string;
  displayDate: string;
  today: string;
  isHistoricalDate: boolean;
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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={popoverRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSelectDate(addDays(selectedDate, -1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
        aria-label="Previous day"
      >
        <ChevronsLeft size={14} />
      </button>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-slate-600"
      >
        <Calendar size={13} className="text-slate-400" />
        <span>{displayDate}</span>
      </button>

      {isHistoricalDate && (
        <button
          type="button"
          onClick={() => onSelectDate(addDays(selectedDate, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
          aria-label="Next day"
        >
          <ChevronsRight size={14} />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-11 z-30 w-[320px] rounded-[24px] border border-slate-700 bg-[#f4f1ea] text-slate-900 shadow-[0_30px_80px_rgba(2,6,23,0.4)]">
          <div className="border-b border-stone-300 px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
                className="font-medium text-slate-700 transition-colors hover:text-slate-950"
              >
                {`<< ${getMonthName(shiftMonth(visibleMonth, -1))}`}
              </button>
              <span className="text-2xl font-semibold text-slate-950">{formatMonthYear(visibleMonth)}</span>
              <button
                type="button"
                onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
                className="font-medium text-slate-700 transition-colors hover:text-slate-950"
              >
                {`${getMonthName(shiftMonth(visibleMonth, 1))} >>`}
              </button>
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="grid grid-cols-7 gap-y-2 text-center text-sm text-slate-700">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="pb-1">
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const isSelected = day.iso === selectedDate;
                const isFuture = day.iso > today;
                return (
                  <button
                    key={day.iso}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      onSelectDate(day.iso);
                      setOpen(false);
                    }}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
                      isSelected
                        ? 'bg-sky-700 font-semibold text-white'
                        : day.inMonth
                        ? 'text-slate-900 hover:bg-sky-100'
                        : 'text-stone-400'
                    } ${isFuture ? 'cursor-not-allowed text-stone-300 hover:bg-transparent' : ''}`}
                  >
                    {day.dayNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-stone-300 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                onSelectDate(today);
                setOpen(false);
              }}
              className="w-full text-center text-base font-semibold text-slate-900 transition-colors hover:text-sky-800"
            >
              Back to Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveTrendChart({
  data,
  costData,
  screenState,
  resolution,
  onResolutionChange,
  viewMode,
  onViewModeChange,
  activeSeries,
  onToggleSeries,
}: {
  data: LivePoint[];
  costData: CostPoint[];
  screenState: ScreenState;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  activeSeries: SeriesKey[];
  onToggleSeries: (series: SeriesKey) => void;
}) {
  const isStale = screenState === 'stale' || screenState === 'warning';
  const cumulativeUsesEnergyUnits = viewMode === 'cumulative' && resolution !== '1min';
  const axisUnit = cumulativeUsesEnergyUnits ? 'kWh' : 'kW';
  const showFilledMinuteView = resolution === '1min' && viewMode === 'line';
  const visibleData = data.flatMap((point) =>
    activeSeries.map((series) => point[series]),
  );
  const maxVisibleValue = visibleData.reduce((max, value) => Math.max(max, value), 0);
  const yAxisMax =
    maxVisibleValue <= 0
      ? 1
      : Number((Math.ceil((maxVisibleValue * 1.1) / 0.5) * 0.5).toFixed(2));

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.34)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Today
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">Live trend</h3>
          <p className="mt-1 text-sm text-slate-400">
            Switch between raw and cumulative views, and strip back series when the story gets noisy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={resolution}
            options={['1min', '30min', '1hour'] as const}
            onChange={onResolutionChange}
            renderLabel={formatResolutionLabel}
          />
          <ToggleGroup
            value={viewMode}
            options={['line', 'cumulative'] as const}
            onChange={onViewModeChange}
          />
        </div>
      </div>

      {isStale && (
        <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          {screenState === 'stale'
            ? 'Data delayed — chart ends at the last known point.'
            : 'Potential anomaly — one recent interval may be overstated.'}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {SERIES_ORDER.map((series) => {
          const active = activeSeries.includes(series);
          return (
            <button
              key={series}
              onClick={() => onToggleSeries(series)}
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
                active
                  ? 'border-slate-600 bg-slate-900/70 text-slate-100'
                  : 'border-slate-800 bg-slate-950/60 text-slate-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[series] }}
                />
                {formatSeriesLabel(series)}
              </span>
              <span className="text-[11px] text-slate-400">
                {active ? <Eye size={13} /> : <EyeOff size={13} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-[400px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No live data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {SERIES_ORDER.map((key) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS[key]} stopOpacity={showFilledMinuteView ? 0.34 : 0.12} />
                    <stop offset="70%" stopColor={SERIES_COLORS[key]} stopOpacity={showFilledMinuteView ? 0.16 : 0.04} />
                    <stop offset="96%" stopColor={SERIES_COLORS[key]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                dataKey="time"
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, yAxisMax]}
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}${axisUnit}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(71,85,105,0.55)',
                  borderRadius: 16,
                  color: '#e2e8f0',
                }}
                formatter={(value, name) => [
                  cumulativeUsesEnergyUnits
                    ? formatKwh(typeof value === 'number' ? value : Number(value ?? 0))
                    : formatKw(typeof value === 'number' ? value : Number(value ?? 0)),
                  formatSeriesLabel(name as SeriesKey),
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
                formatter={(value) => formatSeriesLabel(value as SeriesKey)}
              />
              {SERIES_ORDER.filter((series) => activeSeries.includes(series)).map((series) => (
                <Area
                  key={series}
                  type="linear"
                  dataKey={series}
                  stroke={SERIES_COLORS[series]}
                  fill={`url(#fill-${series})`}
                  fillOpacity={showFilledMinuteView ? 0.5 : 0}
                  strokeWidth={series === 'import' ? 1 : 1.25}
                  activeDot={{ r: 2.5, strokeWidth: 0 }}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Energy value
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Half-hour import cost, solar savings, and export value through the day.
          </p>
        </div>
        <div className="h-[240px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
          {costData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No tariff-backed value data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatEuroTick(Number(value))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(71,85,105,0.55)',
                    borderRadius: 16,
                    color: '#e2e8f0',
                  }}
                  formatter={(value, name) => [
                    formatEuro(typeof value === 'number' ? value : Number(value ?? 0)),
                    formatCostSeriesLabel(name as CostSeriesKey),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
                  formatter={(value) => formatCostSeriesLabel(value as CostSeriesKey)}
                />
                {COST_SERIES_ORDER.map((series) => (
                  <Area
                    key={series}
                    type="linear"
                    dataKey={series}
                    stroke={COST_SERIES_COLORS[series]}
                    fillOpacity={0}
                    strokeWidth={1.25}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
                    dot={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function ValuePanel({
  hasTariff,
  estimate,
}: {
  hasTariff: boolean;
  estimate: FinancialEstimate | null;
}) {
  if (!hasTariff || !estimate) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Today value
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          Add tariff details to unlock live value
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Keep the live energy view useful now, then layer in cost, export value, and savings once
          the tariff setup is complete.
        </p>
        <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
          Add tariff details <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  const items = [
    {
      label: 'Import cost so far',
      value: formatEuro(estimate.importCost),
      tone: 'text-rose-300',
    },
    {
      label: 'Export credit',
      value: formatEuro(estimate.exportCredit),
      tone: 'text-emerald-300',
    },
    {
      label: 'Solar savings',
      value: formatEuro(estimate.solarSavings),
      tone: 'text-amber-300',
    },
    {
      label: 'Net bill impact',
      value: formatEuro(estimate.netBillImpact, true),
      tone: estimate.netBillImpact <= 0 ? 'text-emerald-300' : 'text-cyan-300',
    },
  ];

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Today value
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        Energy and money are telling the same story
      </h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>
      <details className="mt-4 rounded-2xl border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
        <summary className="cursor-pointer list-none font-semibold text-amber-300">
          How these values are calculated
        </summary>
        <div className="mt-3 space-y-2 text-slate-300">
          <p>Import cost = total imported kWh x active tariff rate x VAT.</p>
          <p>Export credit = total exported kWh x export rate.</p>
          <p>Solar savings = generated minus exported kWh x active tariff rate x VAT.</p>
          <p>Net bill impact = import cost - export credit.</p>
        </div>
      </details>
    </div>
  );
}

function TodayPanel({
  totals,
  screenState,
}: {
  totals: LiveScreenProps['todayTotals'];
  screenState: ScreenState;
}) {
  const items = totals
    ? [
        { label: 'Generated', value: formatKwh(totals.generatedKwh), tone: 'text-amber-300' },
        { label: 'Consumed', value: formatKwh(totals.consumedKwh), tone: 'text-slate-200' },
        { label: 'Imported', value: formatKwh(totals.importKwh), tone: 'text-slate-400' },
        { label: 'Exported', value: formatKwh(totals.exportKwh), tone: 'text-emerald-300' },
        {
          label: 'Immersion',
          value: formatKwh(totals.immersionDivertedKwh),
          tone: 'text-rose-300',
        },
      ]
    : [];

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Today so far
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">The day is still building</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>
      {(screenState === 'stale' || screenState === 'warning') && (
        <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          Current-day totals may still change once the live feed stabilizes again.
        </div>
      )}
      <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
        View full day <ChevronRight size={14} />
      </button>
    </div>
  );
}

function SolarCoveragePanel({
  chartData,
  currentSolarShare,
  overallSolarCoverage,
  currentGridDraw,
}: {
  chartData: LivePoint[];
  currentSolarShare: number;
  overallSolarCoverage: number | null;
  currentGridDraw: number;
}) {
  const coverageData = chartData.map((pt) => ({
    time: pt.time,
    coverage:
      pt.consumption > 0
        ? Math.round(Math.min(100, Math.max(0, ((pt.generation - pt.export) / pt.consumption) * 100)))
        : pt.generation > 0
        ? 100
        : 0,
  }));

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Solar coverage
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        How much of the home solar has covered today
      </h3>
      <div className="mt-4 h-44 rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {coverageData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No coverage data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={coverageData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="coverage-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.2} />
                  <stop offset="70%" stopColor="#86efac" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#86efac" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(51,65,85,0.28)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(71,85,105,0.55)',
                  borderRadius: 16,
                  color: '#e2e8f0',
                }}
                formatter={(value) => [`${Number(value ?? 0)}%`, 'Solar coverage']}
              />
              <Area
                type="linear"
                dataKey="coverage"
                stroke="#facc15"
                fill="url(#coverage-fill)"
                strokeWidth={1.2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current</p>
          <p className="mt-1 font-mono text-lg font-semibold text-amber-300">{currentSolarShare}%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Today overall</p>
          <p className="mt-1 font-mono text-lg font-semibold text-emerald-300">
            {overallSolarCoverage !== null ? `${overallSolarCoverage}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Grid draw</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-300">{currentGridDraw}%</p>
        </div>
      </div>
    </div>
  );
}

function SolarContextPanel({ hasCoordinates }: { hasCoordinates: boolean }) {
  if (!hasCoordinates) {
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

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Next
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Solar context</h3>
          <p className="mt-1 text-sm text-slate-400">
            Coordinates-only context: useful, calm, and still honest about what we do not know.
          </p>
        </div>
        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 p-2 text-amber-300">
          <Sun size={18} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile icon={<Sunrise size={14} />} label="Sunrise" value="—" />
        <InfoTile icon={<Sunset size={14} />} label="Sunset" value="—" />
        <InfoTile icon={<Sun size={14} />} label="Sun altitude" value="—" />
        <InfoTile icon={<Activity size={14} />} label="Daylight left" value="—" />
      </div>
    </div>
  );
}

function ForecastPanel({ hasCoordinates }: { hasCoordinates: boolean }) {
  if (!hasCoordinates) {
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

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Near term
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Next few hours</h3>
      <p className="mt-2 text-sm text-slate-400">
        Forecast data is not yet wired in. Coordinates unlock this module.
      </p>
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
  isHistoricalDate,
  timezone,
  screenState,
  health,
  hasTariff,
  hasCoordinates,
  hasCapacity,
  currentMetrics,
  minuteChartData,
  halfHourChartData,
  hourChartData,
  costChartData,
  todayTotals,
  financialEstimate,
}: LiveScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [resolution, setResolution] = useState<Resolution>('1min');
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [activeSeries, setActiveSeries] = useState<SeriesKey[]>(MINUTE_DEFAULT_SERIES);
  const [warningDetailsOpen, setWarningDetailsOpen] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [liveTime, setLiveTime] = useState(initialLiveTime);

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
            Math.max(0, ((todayTotals.consumedKwh - todayTotals.importKwh) / todayTotals.consumedKwh) * 100),
          ),
        )
      : null;

  const displayScreenState: ScreenState =
    screenState === 'warning' && warningDismissed
      ? (health.minutesStale ?? 0) > 30
        ? 'stale'
        : 'healthy'
      : screenState;

  useEffect(() => {
    setActiveSeries(resolution === '1min' ? MINUTE_DEFAULT_SERIES : SERIES_ORDER);
  }, [resolution]);

  useEffect(() => {
    if (isHistoricalDate) return;

    let refreshTimeoutId: number | null = null;
    let clockIntervalId: number | null = null;

    const updateClock = () => {
      setLiveTime(formatClockTime(new Date(), timezone));
    };

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
      updateClock();
      if (document.visibilityState === 'visible') {
        router.refresh();
        scheduleRefresh();
      } else {
        clearRefreshTimer();
      }
    };

    updateClock();
    clockIntervalId = window.setInterval(updateClock, 1_000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleRefresh();

    return () => {
      clearRefreshTimer();
      if (clockIntervalId !== null) window.clearInterval(clockIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, timezone, isHistoricalDate]);

  function navigateToDate(date: string) {
    router.push(buildLiveUrl(pathname, date, today));
  }

  function toggleSeries(series: SeriesKey) {
    setActiveSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1 ? current : current.filter((item) => item !== series);
      }
      return [...current, series];
    });
  }

  const isStale = displayScreenState === 'stale' || displayScreenState === 'warning';
  const isDisconnected = displayScreenState === 'disconnected';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)] font-sans text-slate-100">
      <CapabilityBar
        hasTariff={hasTariff}
        hasCoordinates={hasCoordinates}
        hasCapacity={hasCapacity}
      />
      <NavBar screenState={displayScreenState} />
      <WarningBanner
        screenState={displayScreenState}
        health={health}
        dismissed={warningDismissed}
        onOpenDetails={() => setWarningDetailsOpen(true)}
      />

      <div className="border-b border-slate-800 bg-[#0c1422]/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <TrustBadge
            screenState={displayScreenState}
            health={health}
            dismissed={warningDismissed}
            onOpenDetails={() => setWarningDetailsOpen(true)}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <DatePickerControl
              selectedDate={selectedDate}
              displayDate={displayDate}
              today={today}
              isHistoricalDate={isHistoricalDate}
              onSelectDate={navigateToDate}
            />
            <span className="inline-flex min-w-[92px] justify-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              {liveTime}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              {isDisconnected ? 'No feed' : isHistoricalDate ? 'Selected day' : 'Live now'}
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
          ) : currentMetrics && (
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

              <InsightStrip current={currentMetrics} hasCapacity={hasCapacity} stale={isStale} />
            </>
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
                <LiveTrendChart
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
                  <ValuePanel hasTariff={hasTariff} estimate={financialEstimate} />
                  <TodayPanel totals={todayTotals} screenState={displayScreenState} />
                  <SolarCoveragePanel
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
                <SolarContextPanel hasCoordinates={hasCoordinates} />
                <div className="space-y-4">
                  <ForecastPanel hasCoordinates={hasCoordinates} />
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
        health={health}
        open={warningDetailsOpen}
        onClose={() => setWarningDetailsOpen(false)}
        onDismiss={() => {
          setWarningDismissed(true);
          setWarningDetailsOpen(false);
        }}
      />
    </div>
  );
}
