'use client';

import { use, useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
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

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';
type Resolution = '5min' | '15min' | 'hour';
type ViewMode = 'line' | 'cumulative';
type SeriesKey = 'generation' | 'consumption' | 'import' | 'export';

type LivePoint = {
  time: string;
  generation: number;
  consumption: number;
  import: number;
  export: number;
};

const SERIES_ORDER: SeriesKey[] = ['generation', 'consumption', 'import', 'export'];
const SERIES_COLORS: Record<SeriesKey, string> = {
  generation: '#fbbf24',
  consumption: '#94a3b8',
  import: '#64748b',
  export: '#34d399',
};

const FIVE_MINUTE_DATA: LivePoint[] = [
  { time: '11:00', generation: 1.92, consumption: 1.08, import: 0.22, export: 0.78 },
  { time: '11:05', generation: 2.08, consumption: 1.02, import: 0.12, export: 0.94 },
  { time: '11:10', generation: 2.34, consumption: 0.96, import: 0.04, export: 1.28 },
  { time: '11:15', generation: 2.42, consumption: 1.16, import: 0.14, export: 1.12 },
  { time: '11:20', generation: 2.24, consumption: 1.28, import: 0.2, export: 0.92 },
  { time: '11:25', generation: 2.46, consumption: 1.12, import: 0.08, export: 1.26 },
  { time: '11:30', generation: 2.14, consumption: 0.92, import: 0.1, export: 1.12 },
];

const FIFTEEN_MINUTE_DATA: LivePoint[] = [
  { time: '10:45', generation: 1.54, consumption: 0.96, import: 0.22, export: 0.44 },
  { time: '11:00', generation: 1.96, consumption: 1.04, import: 0.14, export: 0.78 },
  { time: '11:15', generation: 2.42, consumption: 1.16, import: 0.14, export: 1.12 },
  { time: '11:30', generation: 2.14, consumption: 0.92, import: 0.1, export: 1.12 },
];

const HOURLY_DATA: LivePoint[] = [
  { time: '08:00', generation: 0.34, consumption: 0.88, import: 0.62, export: 0 },
  { time: '09:00', generation: 0.92, consumption: 0.96, import: 0.3, export: 0.16 },
  { time: '10:00', generation: 1.58, consumption: 1.02, import: 0.14, export: 0.56 },
  { time: '11:00', generation: 2.14, consumption: 0.92, import: 0.1, export: 1.12 },
];

const TODAY_TOTALS = [
  { label: 'Generated', value: '14.2 kWh', tone: 'text-amber-300' },
  { label: 'Consumed', value: '9.8 kWh', tone: 'text-slate-200' },
  { label: 'Imported', value: '1.6 kWh', tone: 'text-slate-400' },
  { label: 'Exported', value: '4.4 kWh', tone: 'text-emerald-300' },
];

const VALUE_TOTALS = [
  { label: 'Import cost so far', value: '€0.84', tone: 'text-rose-300' },
  { label: 'Export value', value: '€0.29', tone: 'text-emerald-300' },
  { label: 'Solar savings', value: '€1.42', tone: 'text-amber-300' },
  { label: 'Net bill impact', value: '-€0.58', tone: 'text-cyan-300' },
];

function getResolutionData(resolution: Resolution) {
  if (resolution === '15min') return FIFTEEN_MINUTE_DATA;
  if (resolution === 'hour') return HOURLY_DATA;
  return FIVE_MINUTE_DATA;
}

function applyStateToData(data: LivePoint[], screenState: ScreenState) {
  if (screenState === 'disconnected') return [];
  if (screenState === 'healthy') return data;
  if (screenState === 'stale') {
    return data.slice(0, Math.max(1, data.length - 1));
  }
  return data.map((point, index) =>
    index === Math.max(1, data.length - 2)
      ? {
          ...point,
          generation: point.generation * 1.55,
          export: point.export * 1.7,
        }
      : point,
  );
}

function applyViewMode(data: LivePoint[], viewMode: ViewMode) {
  if (viewMode === 'line') return data;

  const running = {
    generation: 0,
    consumption: 0,
    import: 0,
    export: 0,
  };

  return data.map((point) => {
    running.generation += point.generation;
    running.consumption += point.consumption;
    running.import += point.import;
    running.export += point.export;

    return {
      time: point.time,
      generation: Number(running.generation.toFixed(2)),
      consumption: Number(running.consumption.toFixed(2)),
      import: Number(running.import.toFixed(2)),
      export: Number(running.export.toFixed(2)),
    };
  });
}

function formatSeriesLabel(key: SeriesKey) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatKw(value: number) {
  return `${value.toFixed(value >= 1 ? 2 : 2)} kW`;
}

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: ScreenState;
  onChange: (screenState: ScreenState) => void;
}) {
  const states: { id: ScreenState; label: string }[] = [
    { id: 'healthy', label: 'Healthy' },
    { id: 'stale', label: 'Stale data' },
    { id: 'warning', label: 'Warning' },
    { id: 'disconnected', label: 'Disconnected' },
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Prototype state
        </span>
        {states.map((state) => (
          <button
            key={state.id}
            onClick={() => onChange(state.id)}
            className={`rounded-full border px-3 py-1 font-medium transition-colors ${
              current === state.id
                ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {state.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CapabilityBar({
  hasTariff,
  hasCoordinates,
  hasCapacity,
  onToggle,
}: {
  hasTariff: boolean;
  hasCoordinates: boolean;
  hasCapacity: boolean;
  onToggle: (key: 'tariff' | 'coordinates' | 'capacity') => void;
}) {
  const items = [
    { key: 'tariff' as const, label: 'Tariff linked', active: hasTariff },
    { key: 'coordinates' as const, label: 'Coordinates added', active: hasCoordinates },
    { key: 'capacity' as const, label: 'Array capacity known', active: hasCapacity },
  ];

  return (
    <div className="border-b border-slate-800 bg-[#08111f] px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Capability toggles
        </span>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={`rounded-full border px-3 py-1 font-medium transition-colors ${
              item.active
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NavBar({
  screenState,
  onHome,
}: {
  screenState: ScreenState;
  onHome: () => void;
}) {
  return (
    <header className="border-b border-slate-800 bg-[#101826]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            <ChevronLeft size={14} />
            <Home size={13} />
            <span className="hidden sm:inline">Overview</span>
          </button>
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

function TrustBadge({ screenState }: { screenState: ScreenState }) {
  const config: Record<
    ScreenState,
    { icon: ReactNode; label: string; className: string }
  > = {
    healthy: {
      icon: <CheckCircle2 size={13} />,
      label: 'Updated 12 seconds ago',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    stale: {
      icon: <Clock size={13} />,
      label: 'Last seen 18 minutes ago',
      className: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    warning: {
      icon: <TriangleAlert size={13} />,
      label: 'Suspicious reading 3 minutes ago',
      className: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    },
    disconnected: {
      icon: <WifiOff size={13} />,
      label: 'Provider disconnected',
      className: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    },
  };

  const item = config[screenState];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${item.className}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

function WarningBanner({
  screenState,
  onAction,
}: {
  screenState: ScreenState;
  onAction: () => void;
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
      title: 'One reading looks suspicious',
      body: 'A recent interval spikes above the surrounding pattern. This may be a provider reporting issue rather than a real consumption change.',
      cta: 'Review Data Health',
      className: 'border-orange-500/20 bg-orange-500/10 text-orange-200',
      icon: <AlertTriangle size={15} className="mt-0.5 shrink-0" />,
    },
    disconnected: {
      title: 'Provider connection needs attention',
      body: 'Live telemetry has stopped. You can still preserve the screen structure for review, but reconnect is the next real action.',
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
        <button onClick={onAction} className="text-xs font-semibold underline underline-offset-4">
          {config.cta}
        </button>
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

function MobileMetricGrid({ stale }: { stale?: boolean }) {
  const items = [
    { label: 'Gen', value: '2.14', unit: 'kW', tone: 'text-amber-300' },
    { label: 'Use', value: '0.92', unit: 'kW', tone: 'text-slate-100' },
    { label: 'Imp', value: '0.31', unit: 'kW', tone: 'text-slate-300' },
    { label: 'Exp', value: '0.81', unit: 'kW', tone: 'text-emerald-300' },
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
  hasCapacity,
  stale,
}: {
  hasCapacity: boolean;
  stale?: boolean;
}) {
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
              82% of home demand is being covered by solar
            </h3>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 sm:text-xs">
            Covering home + exporting 0.81 kW
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-300"
            style={{ width: '82%' }}
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
            <span className="font-semibold text-emerald-300">Surplus</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Grid draw pressure</span>
            <span className="font-semibold text-slate-200">Low</span>
          </div>
          {hasCapacity && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Array efficiency</span>
              <span className="font-semibold text-cyan-300">78% of 18 kWp max</span>
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
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
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
          {option}
        </button>
      ))}
    </div>
  );
}

function LiveTrendChart({
  data,
  screenState,
  resolution,
  onResolutionChange,
  viewMode,
  onViewModeChange,
  activeSeries,
  onToggleSeries,
}: {
  data: LivePoint[];
  screenState: ScreenState;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  activeSeries: SeriesKey[];
  onToggleSeries: (series: SeriesKey) => void;
}) {
  const isStale = screenState === 'stale' || screenState === 'warning';

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.34)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Today
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">Live trend</h3>
          <p className="mt-1 text-sm text-slate-400">
            Switch between raw and cumulative views, and strip back the series when the story gets noisy.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={resolution}
            options={['5min', '15min', 'hour'] as const}
            onChange={onResolutionChange}
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
              <span className="text-[11px]">{active ? 'Visible' : 'Hidden'}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-[280px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
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
                    <stop offset="4%" stopColor={SERIES_COLORS[key]} stopOpacity={0.28} />
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
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}kW`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(71,85,105,0.55)',
                  borderRadius: 16,
                  color: '#e2e8f0',
                }}
                formatter={(value, name) => [
                  formatKw(typeof value === 'number' ? value : Number(value ?? 0)),
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
                  type="monotone"
                  dataKey={series}
                  stroke={SERIES_COLORS[series]}
                  fill={`url(#fill-${series})`}
                  strokeWidth={series === 'import' ? 1.75 : 2.2}
                  activeDot={{ r: 4 }}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ValuePanel({ hasTariff }: { hasTariff: boolean }) {
  if (!hasTariff) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Today value
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">Add tariff details to unlock live value</h3>
        <p className="mt-2 text-sm text-slate-400">
          Keep the live energy view useful now, then layer in cost, export value, and savings once the tariff setup is complete.
        </p>
        <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
          Add tariff details <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Today value
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Energy and money are telling the same story</h3>
      <div className="mt-4 space-y-3">
        {VALUE_TOTALS.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
        Low import during the brightest window is protecting the bill while export is adding a small credit on top.
      </div>
    </div>
  );
}

function TodayPanel({ screenState }: { screenState: ScreenState }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Today so far
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">The day is still building</h3>
      <div className="mt-4 space-y-3">
        {TODAY_TOTALS.map((item) => (
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

function SolarCoveragePanel() {
  const coverageData = [
    { time: '08:00', coverage: 22 },
    { time: '09:00', coverage: 44 },
    { time: '10:00', coverage: 67 },
    { time: '11:00', coverage: 82 },
    { time: '12:00', coverage: 89 },
    { time: '13:00', coverage: 85 },
    { time: '14:00', coverage: 73 },
    { time: '15:00', coverage: 68 },
    { time: '16:00', coverage: 57 },
  ];

  const best = coverageData.reduce((current, point) =>
    point.coverage > current.coverage ? point : current,
  );

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Solar coverage
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">How much of the home solar has covered today</h3>
      <div className="mt-4 h-44 rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={coverageData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="coverage-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.34} />
                <stop offset="70%" stopColor="#86efac" stopOpacity={0.18} />
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
              type="monotone"
              dataKey="coverage"
              stroke="#facc15"
              fill="url(#coverage-fill)"
              strokeWidth={2.4}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current</p>
          <p className="mt-1 font-mono text-lg font-semibold text-amber-300">82%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Best hour</p>
          <p className="mt-1 font-mono text-lg font-semibold text-emerald-300">
            {best.coverage}% <span className="text-sm text-slate-500">@ {best.time}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Grid share</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-300">18%</p>
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
        <h3 className="mt-1 text-lg font-semibold text-slate-50">Add coordinates to unlock solar context</h3>
        <p className="mt-2 text-sm text-slate-400">
          Sunrise, sunset, daylight remaining, and sun-position cues can all live here without needing full roof modeling.
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
        <InfoTile icon={<Sunrise size={14} />} label="Sunrise" value="06:08" />
        <InfoTile icon={<Sunset size={14} />} label="Sunset" value="18:52" />
        <InfoTile icon={<Sun size={14} />} label="Sun altitude" value="43.4°" />
        <InfoTile icon={<Activity size={14} />} label="Daylight left" value="6h 33m" />
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-800 bg-[#0b1321] p-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Solar window today</span>
          <span>Peak window around 13:30</span>
        </div>
        <div className="mt-4 h-24 rounded-[20px] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_38%),linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.3)_100%)] p-4">
          <div className="relative h-full">
            <div className="absolute inset-x-0 bottom-4 h-px bg-slate-700" />
            <div className="absolute bottom-4 left-[8%] h-10 w-px border-l border-dashed border-slate-600" />
            <div className="absolute bottom-4 left-[50%] h-16 w-px border-l border-dashed border-amber-400/60" />
            <div className="absolute bottom-4 left-[84%] h-8 w-px border-l border-dashed border-slate-600" />
            <div className="absolute bottom-14 left-[48%] rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
              solar noon
            </div>
          </div>
        </div>
      </div>

      <HourlyWeatherStrip />
    </div>
  );
}

function HourlyWeatherStrip() {
  const weather = [
    { time: '12pm', temp: '11°', icon: <Sun size={16} />, label: 'Clear' },
    { time: '1pm', temp: '12°', icon: <Sun size={16} />, label: 'Bright' },
    { time: '2pm', temp: '12°', icon: <Wind size={16} />, label: 'Breezy' },
    { time: '3pm', temp: '11°', icon: <Sun size={16} />, label: 'Light cloud' },
    { time: '4pm', temp: '10°', icon: <Sunset size={16} />, label: 'Cooling' },
  ];

  return (
    <div className="mt-5 rounded-[24px] border border-slate-800 bg-[#0b1321] p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Hourly weather forecast</span>
        <span>Next 5 hours</span>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {weather.map((item) => (
          <div key={item.time} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-2 py-3 text-center">
            <p className="text-[11px] font-semibold text-slate-400">{item.time}</p>
            <div className="mt-2 flex justify-center text-amber-300">{item.icon}</div>
            <p className="mt-2 text-sm font-semibold text-slate-100">{item.temp}</p>
            <p className="mt-1 text-[11px] text-slate-500">{item.label}</p>
          </div>
        ))}
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
        <h3 className="mt-1 text-lg font-semibold text-slate-50">Forecast held back until site context exists</h3>
        <p className="mt-2 text-sm text-slate-400">
          Weather alone can be shown later, but the more useful version combines it with daylight timing and expected solar window.
        </p>
      </div>
    );
  }

  const forecast = [
    { label: 'Expected peak', value: '1pm to 2pm', tone: 'text-amber-300' },
    { label: 'Cloud risk', value: 'Low', tone: 'text-emerald-300' },
    { label: 'Export outlook', value: 'Likely until 4pm', tone: 'text-cyan-300' },
  ];

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Near term
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Next few hours</h3>
      <div className="mt-4 space-y-3">
        {forecast.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        Short-horizon outlook is strongest when it explains the next solar opportunity window, not just generic weather.
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
          <p className="font-semibold text-slate-100">Why this feels different</p>
          <p className="mt-1 text-slate-400">
            The page now explains the present, the day, and the next solar window instead of stopping at four top cards and one chart.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="font-semibold text-slate-100">Capability gating</p>
          <p className="mt-1 text-slate-400">
            {hasTariff
              ? 'Tariff data is present, so live value can be shown without pretending it is the primary lens.'
              : 'Tariff data is missing, so value stays as a prompt card while live energy remains fully useful.'}
          </p>
          <p className="mt-1 text-slate-400">
            {hasCoordinates
              ? 'Coordinates allow daylight and sun-position context, but not house-relative or roof-relative claims.'
              : 'Coordinates are absent, so the page deliberately withholds solar-context modules instead of filling space with decorative content.'}
          </p>
        </div>
        {(screenState === 'stale' || screenState === 'warning') && (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-100">
            <p className="font-semibold">
              {screenState === 'stale' ? 'Stale state' : 'Suspicious-data state'}
            </p>
            <p className="mt-1 text-orange-100/80">
              Warnings stay calm and actionable; the page preserves context without quietly hiding uncertainty.
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
      <h2 className="mt-5 text-2xl font-semibold text-slate-50">Live feed paused</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
        The provider connection has stopped, so the prototype shifts focus from live interpretation to recovery. In production, this state would preserve the same hierarchy but pin reconnect as the next action.
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

export function LiveScreen({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const params = use(searchParams);
  const initialState = (params.state as ScreenState) ?? 'healthy';
  const [screenState, setScreenState] = useState<ScreenState>(initialState);
  const [resolution, setResolution] = useState<Resolution>('5min');
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [hasTariff, setHasTariff] = useState(true);
  const [hasCoordinates, setHasCoordinates] = useState(true);
  const [hasCapacity, setHasCapacity] = useState(true);
  const [activeSeries, setActiveSeries] = useState<SeriesKey[]>(SERIES_ORDER);

  const chartData = useMemo(() => {
    const base = getResolutionData(resolution);
    const stateAdjusted = applyStateToData(base, screenState);
    return applyViewMode(stateAdjusted, viewMode);
  }, [resolution, screenState, viewMode]);

  function toggleCapability(key: 'tariff' | 'coordinates' | 'capacity') {
    if (key === 'tariff') setHasTariff((current) => !current);
    if (key === 'coordinates') setHasCoordinates((current) => !current);
    if (key === 'capacity') setHasCapacity((current) => !current);
  }

  function toggleSeries(series: SeriesKey) {
    setActiveSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1 ? current : current.filter((item) => item !== series);
      }
      return [...current, series];
    });
  }

  const isStale = screenState === 'stale' || screenState === 'warning';
  const isDisconnected = screenState === 'disconnected';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)] font-sans text-slate-100">
      <PrototypeSwitcher current={screenState} onChange={setScreenState} />
      <CapabilityBar
        hasTariff={hasTariff}
        hasCoordinates={hasCoordinates}
        hasCapacity={hasCapacity}
        onToggle={toggleCapability}
      />
      <NavBar screenState={screenState} onHome={() => undefined} />
      <WarningBanner screenState={screenState} onAction={() => undefined} />

      <div className="border-b border-slate-800 bg-[#0c1422]/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <TrustBadge screenState={screenState} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              Sat 28 Mar 2026
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5">
              Live now
            </span>
            <span className="hidden rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 sm:inline-flex">
              Healthy window: midday solar surplus
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Now"
            title="What the system is doing right now"
            description="The first layer stays operational: current power, freshness, and a quick interpretation of whether solar is carrying the home."
          />

          {isDisconnected ? (
            <DisconnectedState />
          ) : (
            <>
              <MobileMetricGrid stale={isStale} />

              <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Generation"
                  value="2,140"
                  unit="W"
                  caption="from panels"
                  icon={<Zap size={16} />}
                  accentClass="text-amber-300"
                  stale={isStale}
                />
                <MetricCard
                  label="Consumption"
                  value="920"
                  unit="W"
                  caption="home using now"
                  icon={<Home size={16} />}
                  accentClass="text-slate-300"
                  stale={isStale}
                />
                <MetricCard
                  label="Import"
                  value="310"
                  unit="W"
                  caption="from grid"
                  icon={<ArrowDownToLine size={16} />}
                  accentClass="text-slate-400"
                  stale={isStale}
                />
                <MetricCard
                  label="Export"
                  value="810"
                  unit="W"
                  caption="to grid"
                  icon={<ArrowUpFromLine size={16} />}
                  accentClass="text-emerald-300"
                  stale={isStale}
                />
              </div>

              <InsightStrip hasCapacity={hasCapacity} stale={isStale} />
            </>
          )}
        </section>

        {!isDisconnected && (
          <>
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Today"
                title="What today has meant so far"
                description="The second layer combines live trend, same-day totals, and financial interpretation without turning the page into a billing dashboard."
              />

              <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
                <LiveTrendChart
                  data={chartData}
                  screenState={screenState}
                  resolution={resolution}
                  onResolutionChange={setResolution}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  activeSeries={activeSeries}
                  onToggleSeries={toggleSeries}
                />

                <div className="space-y-4">
                  <ValuePanel hasTariff={hasTariff} />
                  <TodayPanel screenState={screenState} />
                  <SolarCoveragePanel />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                eyebrow="Next"
                title="What is likely to happen over the next few hours"
                description="The final layer adds daylight, weather, and near-term solar context so the Live screen feels like a real energy platform rather than a theme-skinned inverter dashboard."
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
    </div>
  );
}
