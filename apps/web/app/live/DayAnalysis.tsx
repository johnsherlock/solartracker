'use client';

import { useState } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
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
import {
  buildEnergyTrendOption,
  buildCostOption,
  buildCoverageOption,
} from '@/src/live/echartsOptions';

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

  const eyebrow = mode === 'historical' ? 'Day' : 'Today';
  const title = mode === 'historical' ? 'Energy trend' : 'Live trend';
  const emptyLabel = mode === 'historical' ? 'No data for this day' : 'No live data available';

  const energyOption = buildEnergyTrendOption(
    data,
    activeSeries,
    viewMode,
    resolution,
    hoveredSeries,
  );

  const costOption = buildCostOption(costData, viewMode);

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_30px_70px_rgba(2,6,23,0.34)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
          <p className="hidden sm:block mt-1 text-sm text-slate-400">
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

      <div className="mt-4 grid grid-cols-3 gap-1.5 lg:grid-cols-5">
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

      <div className="mt-4 h-[260px] sm:h-[400px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          <EChart
            option={energyOption}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
            lazyUpdate={false}
          />
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
        <div className="h-[220px] sm:h-[330px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
          {costData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No tariff-backed value data available
            </div>
          ) : (
            <EChart
              option={costOption}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
              lazyUpdate={false}
            />
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

  const coverageOption = buildCoverageOption(coverageData);

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Solar coverage
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">{heading}</h3>
      <div className="mt-4 h-32 sm:h-44 rounded-[24px] border border-slate-800 bg-[#0b1321] p-3">
        {coverageData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No coverage data yet
          </div>
        ) : (
          <EChart
            option={coverageOption}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
            lazyUpdate={false}
          />
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
