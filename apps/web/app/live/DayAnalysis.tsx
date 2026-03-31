'use client';

import { useState } from 'react';
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
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { CostPoint, FinancialEstimate, LivePoint } from '@/src/live/loader';
import {
  SERIES_ORDER,
  SERIES_COLORS,
  COST_SERIES_ORDER,
  COST_SERIES_COLORS,
  formatSeriesLabel,
  formatCostSeriesLabel,
  formatResolutionLabel,
  formatKw,
  formatKwh,
  formatEuro,
  formatEuroTick,
} from '@/src/live/chartUtils';

export type { Resolution, ViewMode, SeriesKey, CostSeriesKey } from '@/src/live/chartUtils';
export {
  SERIES_ORDER,
  SERIES_COLORS,
  MINUTE_DEFAULT_SERIES,
  COST_SERIES_ORDER,
  COST_SERIES_COLORS,
  applyViewMode,
  applyCostViewMode,
  formatSeriesLabel,
  formatCostSeriesLabel,
  formatResolutionLabel,
  formatKw,
  formatW,
  formatKwh,
  formatEuro,
  formatEuroTick,
  formatClockTime,
  parseIsoDate,
  addDays,
  startOfMonth,
  shiftMonth,
  formatMonthYear,
  getMonthName,
  getMonthDays,
} from '@/src/live/chartUtils';

import type { Resolution, ViewMode, SeriesKey } from '@/src/live/chartUtils';

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

// ---------------------------------------------------------------------------
// ToggleGroup
// ---------------------------------------------------------------------------

export function ToggleGroup<T extends string>({
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

// ---------------------------------------------------------------------------
// DayTrendChart
// ---------------------------------------------------------------------------

export function DayTrendChart({
  mode,
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
  mode: 'live' | 'historical';
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
  const [hoveredSeries, setHoveredSeries] = useState<SeriesKey | null>(null);
  const isStale = screenState === 'stale' || screenState === 'warning';
  const cumulativeUsesEnergyUnits = viewMode === 'cumulative' && resolution !== '1min';
  const axisUnit = cumulativeUsesEnergyUnits ? 'kWh' : 'kW';
  const showFilledMinuteView = resolution === '1min' && viewMode === 'line';
  const visibleData = data.flatMap((point) => activeSeries.map((series) => point[series]));
  const maxVisibleValue = visibleData.reduce((max, value) => Math.max(max, value), 0);
  const yAxisMax =
    maxVisibleValue <= 0
      ? 1
      : Number((Math.ceil((maxVisibleValue * 1.1) / 0.5) * 0.5).toFixed(2));

  const eyebrow = mode === 'historical' ? 'Day' : 'Today';
  const title = mode === 'historical' ? 'Energy trend' : 'Live trend';
  const emptyLabel = mode === 'historical' ? 'No data for this day' : 'No live data available';

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.34)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">
            Switch between raw and cumulative views, and strip back series when the story gets
            noisy.
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

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
        {SERIES_ORDER.map((series) => {
          const active = activeSeries.includes(series);
          const isHovered = hoveredSeries === series;
          return (
            <button
              key={series}
              onClick={() => onToggleSeries(series)}
              onMouseEnter={() => setHoveredSeries(series)}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex min-w-0 items-center gap-1 rounded-xl border px-2 py-1.5 text-left text-[12px] leading-none transition-colors ${
                active
                  ? isHovered
                    ? 'border-slate-500 bg-slate-900 text-slate-50'
                    : 'border-slate-600 bg-slate-900/70 text-slate-100'
                  : 'border-slate-800 bg-slate-950/60 text-slate-500'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[series] }}
                />
                <span className="truncate">{formatSeriesLabel(series)}</span>
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                {active ? <Eye size={12} /> : <EyeOff size={12} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-[400px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {SERIES_ORDER.map((key) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={SERIES_COLORS[key]}
                      stopOpacity={showFilledMinuteView ? 0.34 : 0.12}
                    />
                    <stop
                      offset="70%"
                      stopColor={SERIES_COLORS[key]}
                      stopOpacity={showFilledMinuteView ? 0.16 : 0.04}
                    />
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
                  fillOpacity={
                    showFilledMinuteView
                      ? hoveredSeries && hoveredSeries !== series
                        ? 0.08
                        : 0.5
                      : 0
                  }
                  strokeOpacity={hoveredSeries && hoveredSeries !== series ? 0.2 : 1}
                  strokeWidth={hoveredSeries === series ? 2 : series === 'import' ? 1 : 1.25}
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
        <div className="h-[330px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
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
                    formatCostSeriesLabel(name as 'importCost' | 'savings' | 'exportCredit'),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }}
                  formatter={(value) =>
                    formatCostSeriesLabel(value as 'importCost' | 'savings' | 'exportCredit')
                  }
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

// ---------------------------------------------------------------------------
// DayValuePanel
// ---------------------------------------------------------------------------

export function DayValuePanel({
  mode,
  hasTariff,
  estimate,
}: {
  mode: 'live' | 'historical';
  hasTariff: boolean;
  estimate: FinancialEstimate | null;
}) {
  if (!hasTariff || !estimate) {
    return (
      <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {mode === 'historical' ? 'Day value' : 'Today value'}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-50">
          {mode === 'historical'
            ? 'Add tariff details to unlock day value'
            : 'Add tariff details to unlock live value'}
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
    { label: 'Import cost', value: formatEuro(estimate.importCost), tone: 'text-rose-300' },
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
        {mode === 'historical' ? 'Day value' : 'Today value'}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        {mode === 'historical' ? 'Cost and savings' : 'Cost and savings so far'}
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

// ---------------------------------------------------------------------------
// DayTotalsPanel
// ---------------------------------------------------------------------------

type DayTotals = {
  generatedKwh: number;
  consumedKwh: number;
  importKwh: number;
  exportKwh: number;
  immersionDivertedKwh: number;
};

export function DayTotalsPanel({
  mode,
  totals,
  screenState,
}: {
  mode: 'live' | 'historical';
  totals: DayTotals | null;
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
        {mode === 'historical' ? 'Day totals' : 'Today so far'}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        {mode === 'historical' ? 'Final day totals' : 'The day is still building'}
      </h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-400">{item.label}</span>
            <span className={`font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
          </div>
        ))}
      </div>
      {mode === 'live' && (screenState === 'stale' || screenState === 'warning') && (
        <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          Current-day totals may still change once the live feed stabilizes again.
        </div>
      )}
      {mode === 'live' && (
        <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
          View full day <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SolarCoveragePanel
// ---------------------------------------------------------------------------

export function SolarCoveragePanel({
  mode,
  chartData,
  currentSolarShare,
  overallSolarCoverage,
  currentGridDraw,
}: {
  mode: 'live' | 'historical';
  chartData: LivePoint[];
  currentSolarShare: number;
  overallSolarCoverage: number | null;
  currentGridDraw: number;
}) {
  const coverageData = chartData.map((pt) => ({
    time: pt.time,
    coverage:
      pt.consumption > 0
        ? Math.round(
            Math.min(100, Math.max(0, ((pt.generation - pt.export) / pt.consumption) * 100)),
          )
        : pt.generation > 0
          ? 100
          : 0,
  }));

  const heading =
    mode === 'historical'
      ? 'Solar coverage for the day'
      : 'How much of the home solar has covered today';

  const firstStatLabel = mode === 'historical' ? 'Final Solar Coverage' : 'Current Solar Coverage';
  const secondStatLabel = mode === 'historical' ? "Day's Total Coverage" : "Today's Total Coverage";
  const thirdStatLabel = mode === 'historical' ? 'Final Grid Draw' : 'Current Grid Draw';

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Solar coverage
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">{heading}</h3>
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
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{firstStatLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-amber-300">
            {currentSolarShare}%
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {secondStatLabel}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-emerald-300">
            {overallSolarCoverage !== null ? `${overallSolarCoverage}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{thirdStatLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-300">{currentGridDraw}%</p>
        </div>
      </div>
    </div>
  );
}
