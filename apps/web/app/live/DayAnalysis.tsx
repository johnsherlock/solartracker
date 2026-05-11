'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import type {
  CostPoint,
  FinancialEstimate,
  GenerationRank,
  HistoricalMetricRanks,
  LivePoint,
} from '@/src/live/loader';
import type { CalendarMetric } from '@/src/calendar/types';
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
  type TrendIndicatorData,
  resolveFinalCostRow,
} from '@/src/live/dayCardModel';
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

function trendTone(trend: TrendIndicatorData): string {
  if (trend.tone === 'neutral') {
    return trend.strength === 'strong'
      ? 'text-amber-200'
      : trend.strength === 'medium'
        ? 'text-amber-300'
        : 'text-amber-400';
  }

  if (trend.tone === 'positive') {
    return trend.strength === 'strong'
      ? 'text-emerald-200'
      : trend.strength === 'medium'
        ? 'text-emerald-300'
        : 'text-emerald-400';
  }

  return trend.strength === 'strong'
    ? 'text-rose-200'
    : trend.strength === 'medium'
      ? 'text-rose-300'
      : 'text-rose-400';
}

function trendArrow(trend: TrendIndicatorData): string {
  if (trend.direction === 'same') return '→';
  return trend.direction === 'up' ? '↑' : '↓';
}

function useOutsideClose(ref: RefObject<HTMLElement | null>, enabled: boolean, onClose: () => void) {
  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, enabled, onClose]);
}

function TrendPill({ trend }: { trend?: TrendIndicatorData }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const close = () => setOpen(false);

  useOutsideClose(wrapperRef, open, close);

  if (!trend) {
    return <span className="text-right font-mono text-sm text-slate-600">—</span>;
  }

  return (
    <span ref={wrapperRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label={trend.summary}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        className={`text-right font-mono text-xl font-bold leading-none ${trendTone(trend)}`}
      >
        {trendArrow(trend)}
      </button>
      {open && (
        <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 min-w-40 max-w-52 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-left text-[11px] font-medium leading-4 text-slate-200 shadow-[0_18px_40px_rgba(2,6,23,0.55)]">
          {trend.summary}
        </span>
      )}
    </span>
  );
}

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
  sunMarkers,
  screenState,
  resolution,
  onResolutionChange,
  viewMode,
  onViewModeChange,
  activeSeries,
  onToggleSeries,
  footer,
}: {
  mode: 'live' | 'historical';
  data: LivePoint[];
  costData: CostPoint[];
  sunMarkers?: {
    energy: { time: string; label: string }[];
    cost: { time: string; label: string }[];
  };
  screenState: ScreenState;
  resolution: Resolution;
  onResolutionChange: (resolution: Resolution) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  activeSeries: SeriesKey[];
  onToggleSeries: (series: SeriesKey) => void;
  footer?: ReactNode;
}) {
  const [hoveredSeries, setHoveredSeries] = useState<SeriesKey | null>(null);
  const [zoomWindow, setZoomWindow] = useState<{ start: number; end: number } | null>(null);
  const isStale = screenState === 'stale' || screenState === 'warning';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const energyChartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costChartRef = useRef<any>(null);

  const eyebrow = mode === 'historical' ? 'Day' : 'Today';
  const title = mode === 'historical' ? 'Energy trend' : 'Live trend';
  const emptyLabel = mode === 'historical' ? 'No data for this day' : 'No live data available';

  const energyOption = useMemo(
    () =>
      buildEnergyTrendOption(
        data,
        activeSeries,
        viewMode,
        resolution,
        hoveredSeries,
        sunMarkers?.energy,
        zoomWindow,
      ),
    [activeSeries, data, hoveredSeries, resolution, sunMarkers, viewMode, zoomWindow],
  );

  const costOption = useMemo(
    () => buildCostOption(costData, viewMode, sunMarkers?.cost, zoomWindow),
    [costData, sunMarkers, viewMode, zoomWindow],
  );
  const resolutionOptions =
    mode === 'historical'
      ? (['1min', '30min'] as const)
      : (['1min', '30min', '1hour'] as const);

  useEffect(() => {
    setZoomWindow(null);
  }, [resolution, viewMode, mode]);

  useEffect(() => {
    const instance = energyChartRef.current?.getEchartsInstance();
    if (!instance) return;
    let frame: number | null = null;

    const handleDataZoom = (event: {
      batch?: Array<{ start?: number; end?: number }>;
      start?: number;
      end?: number;
    }) => {
      const batch = event.batch?.[0];
      const start = event.start ?? batch?.start;
      const end = event.end ?? batch?.end;
      if (typeof start === 'number' && typeof end === 'number') {
        if (frame != null) {
          cancelAnimationFrame(frame);
        }
        frame = requestAnimationFrame(() => {
          setZoomWindow({ start, end });
        });
      }
    };

    const handleRestore = () => {
      if (frame != null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      requestAnimationFrame(() => {
        setZoomWindow(null);
      });
    };

    instance.on('dataZoom', handleDataZoom);
    instance.on('restore', handleRestore);

    return () => {
      if (frame != null) {
        cancelAnimationFrame(frame);
      }
      instance.off('dataZoom', handleDataZoom);
      instance.off('restore', handleRestore);
    };
  }, [resolution]);

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

        <div className="flex flex-row flex-wrap items-center gap-2 xl:flex-nowrap">
          <ToggleGroup
            value={resolution}
            options={resolutionOptions}
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

      <div
        className="mt-4 h-[260px] sm:h-[400px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3"
        onClick={() => energyChartRef.current?.getEchartsInstance().dispatchAction({ type: 'hideTip' })}
      >
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          <EChart
            ref={energyChartRef}
            key={resolution}
            option={energyOption}
            style={{ height: '100%', width: '100%' }}
            notMerge={false}
          />
        )}
      </div>

      <div className="mt-5">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Energy value
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Half-hour import cost, self-consumed solar value, and export value through the day.
          </p>
        </div>
        <div
          className="h-[220px] sm:h-[330px] rounded-[24px] border border-slate-800 bg-[#0b1321] p-3"
          onClick={() => costChartRef.current?.getEchartsInstance().dispatchAction({ type: 'hideTip' })}
        >
          {costData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No tariff-backed value data available
            </div>
          ) : (
            <EChart
              ref={costChartRef}
              option={costOption}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
              lazyUpdate={false}
            />
          )}
        </div>
      </div>

      {footer ? <div className="mt-5 border-t border-slate-800/80 pt-5">{footer}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayValuePanel
// ---------------------------------------------------------------------------

function buildCalendarMetricUrl(selectedDate: string, metric: CalendarMetric): string {
  return `/calendar?year=${selectedDate.slice(0, 4)}&metric=${metric}`;
}

function formatRank(rank: GenerationRank | undefined): string {
  return rank ? `#${rank.rank}` : '—';
}

export function DayValuePanel({
  mode,
  hasTariff,
  estimate,
  selectedDate,
  rankings,
  repaymentCoverage,
  trends,
}: {
  mode: 'live' | 'historical';
  hasTariff: boolean;
  estimate: FinancialEstimate | null;
  selectedDate?: string;
  rankings?: HistoricalMetricRanks;
  repaymentCoverage?: { amount: number; percent: number } | null;
  trends?: Partial<Record<string, TrendIndicatorData>>;
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
        <Link
          href="/settings/tariffs"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-300"
        >
          Add tariff details <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  const items = [
    {
      label: 'Import cost',
      value: formatEuro(estimate.importCost),
      tone: 'text-rose-300',
      metric: 'import_cost' as const,
      trendKey: 'import_cost',
    },
    {
      label: 'Export credit',
      value: formatEuro(estimate.exportCredit),
      tone: 'text-emerald-300',
      metric: 'export_credit' as const,
      trendKey: 'export_credit',
    },
    {
      label: 'Onsite solar value',
      value: formatEuro(estimate.solarSavings),
      tone: 'text-amber-300',
      metric: 'self_consumed_value' as const,
      trendKey: 'onsite_solar_value',
    },
    {
      label: 'Net energy bill',
      value: formatEuro(estimate.netBillImpact, true),
      tone: estimate.netBillImpact <= 0 ? 'text-emerald-300' : 'text-cyan-300',
      metric: 'net_energy_bill' as const,
      trendKey: 'net_energy_bill',
    },
  ];
  const finalRow = resolveFinalCostRow(repaymentCoverage ?? null);
  const totalSolarValue = estimate.solarSavings + estimate.exportCredit;
  const showRankings = mode === 'historical' && !!selectedDate && !!rankings;
  const showTrends = !!trends;
  const gridClass = showRankings
    ? 'grid grid-cols-[minmax(0,1fr)_120px_32px_44px] items-baseline gap-3'
    : showTrends
      ? 'grid grid-cols-[minmax(0,1fr)_120px_32px] items-baseline gap-3'
      : 'flex items-baseline justify-between gap-3';

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {mode === 'historical' ? 'Day value' : 'Today value'}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        {mode === 'historical' ? 'Cost and savings' : 'Cost and savings so far'}
      </h3>
      <div className="mt-4 space-y-2.5">
        {(showRankings || showTrends) && (
          <div
            className={`${
              showRankings
                ? 'grid grid-cols-[minmax(0,1fr)_120px_32px_44px]'
                : 'grid grid-cols-[minmax(0,1fr)_120px_32px]'
            } gap-3 border-b border-slate-800/80 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500`}
          >
            <span>Metric</span>
            <span className="text-right">Value</span>
            {showTrends && <span className="text-right">Trend</span>}
            {showRankings && <span className="text-right">Rank</span>}
          </div>
        )}
        {items.map((item) => {
          const rank = item.metric ? rankings?.[item.metric] : undefined;
          const trend = item.trendKey ? trends?.[item.trendKey] : undefined;
          return (
            <div
              key={item.label}
              className={gridClass}
            >
              <span className="text-sm text-slate-400">{item.label}</span>
              <span className={`text-right font-mono text-sm font-semibold whitespace-nowrap ${item.tone}`}>{item.value}</span>
              {showTrends && <TrendPill trend={trend} />}
              {showRankings && selectedDate && item.metric && (
                <Link
                  href={buildCalendarMetricUrl(selectedDate, item.metric)}
                  className="text-right font-mono text-sm font-semibold text-slate-300 transition-colors hover:text-sky-300"
                >
                  {formatRank(rank)}
                </Link>
              )}
            </div>
          );
        })}
        <div className={`${gridClass} border-t border-slate-800/80 pt-2.5`}>
          <span className="text-sm text-slate-400">{finalRow.label}</span>
          <span className="text-right font-mono text-xs font-semibold whitespace-nowrap text-violet-300 sm:text-sm">
            {finalRow.metric === 'prorata_coverage' && repaymentCoverage
              ? `${formatEuro(repaymentCoverage.amount)} (${repaymentCoverage.percent}%)`
              : formatEuro(totalSolarValue)}
          </span>
          {showTrends && <TrendPill trend={trends?.[finalRow.trendKey]} />}
          {showRankings && selectedDate ? (
            <Link
              href={buildCalendarMetricUrl(selectedDate, finalRow.metric)}
              className="text-right font-mono text-sm font-semibold text-slate-300 transition-colors hover:text-sky-300"
            >
              {formatRank(rankings?.[finalRow.metric])}
            </Link>
          ) : null}
        </div>
      </div>
      <details className="mt-4 rounded-2xl border border-slate-700/40 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
        <summary className="cursor-pointer list-none font-semibold text-amber-300">
          How these values are calculated
        </summary>
        <div className="mt-3 space-y-2 text-slate-300">
          <p>Import cost = each half-hour imported kWh x that period&apos;s tariff rate x VAT, summed across the day.</p>
          <p>Export credit = total exported kWh x export rate.</p>
          <p>Onsite solar value = each half-hour kWh used onsite from solar x that period&apos;s tariff rate x VAT, summed across the day.</p>
          <p>Net energy bill = import cost - export credit.</p>
          <p>{finalRow.explanation}</p>
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
  selectedDate,
  rankings,
  trends,
  liveHeading,
}: {
  mode: 'live' | 'historical';
  totals: DayTotals | null;
  screenState: ScreenState;
  selectedDate?: string;
  rankings?: HistoricalMetricRanks;
  trends?: Partial<Record<string, TrendIndicatorData>>;
  liveHeading?: string;
}) {
  const items = totals
    ? [
        {
          label: 'Generated',
          value: formatKwh(totals.generatedKwh),
          tone: 'text-amber-300',
          metric: 'generation_kwh' as const,
          trendKey: 'generation_kwh',
        },
        {
          label: 'Consumed',
          value: formatKwh(totals.consumedKwh),
          tone: 'text-slate-200',
          metric: 'consumed_kwh' as const,
          trendKey: 'consumed_kwh',
        },
        {
          label: 'Imported',
          value: formatKwh(totals.importKwh),
          tone: 'text-slate-400',
          metric: 'import_kwh' as const,
          trendKey: 'import_kwh',
        },
        {
          label: 'Exported',
          value: formatKwh(totals.exportKwh),
          tone: 'text-emerald-300',
          metric: 'export_kwh' as const,
          trendKey: 'export_kwh',
        },
        {
          label: 'Immersion',
          value: formatKwh(totals.immersionDivertedKwh),
          tone: 'text-rose-300',
          metric: 'immersion_kwh' as const,
          trendKey: 'immersion_kwh',
        },
      ]
    : [];
  const showRankings = mode === 'historical' && !!selectedDate && !!rankings;
  const showTrends = !!trends;
  const gridClass = showRankings
    ? 'grid grid-cols-[minmax(0,1fr)_92px_32px_44px] items-baseline gap-3'
    : showTrends
      ? 'grid grid-cols-[minmax(0,1fr)_92px_32px] items-baseline gap-3'
      : 'flex items-baseline justify-between gap-3';

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {mode === 'historical' ? 'Day totals' : 'Today so far'}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">
        {mode === 'historical' ? 'Final day totals' : liveHeading ?? 'The day is taking shape'}
      </h3>
      <div className="mt-4 space-y-3">
        {(showRankings || showTrends) && (
          <div
            className={`${
              showRankings
                ? 'grid grid-cols-[minmax(0,1fr)_92px_32px_44px]'
                : 'grid grid-cols-[minmax(0,1fr)_92px_32px]'
            } gap-3 border-b border-slate-800/80 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500`}
          >
            <span>Metric</span>
            <span className="text-right">Value</span>
            {showTrends && <span className="text-right">Trend</span>}
            {showRankings && <span className="text-right">Rank</span>}
          </div>
        )}
        {items.map((item) => {
          const rank = item.metric ? rankings?.[item.metric] : undefined;
          const trend = item.trendKey ? trends?.[item.trendKey] : undefined;
          return (
            <div
              key={item.label}
              className={gridClass}
            >
              <span className="text-sm text-slate-400">{item.label}</span>
              <span className={`text-right font-mono text-sm font-semibold ${item.tone}`}>{item.value}</span>
              {showTrends && <TrendPill trend={trend} />}
              {showRankings && selectedDate && item.metric && (
                <Link
                  href={buildCalendarMetricUrl(selectedDate, item.metric)}
                  className="text-right font-mono text-sm font-semibold text-slate-300 transition-colors hover:text-sky-300"
                >
                  {formatRank(rank)}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {mode === 'live' && (screenState === 'stale' || screenState === 'warning') && (
        <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          Current-day totals may still change once the live feed stabilizes again.
        </div>
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
  sunMarkers,
  overallSolarCoverage,
  currentSolarShare,
  currentGridDraw,
  historicalHoursAboveThreshold,
  historicalDaylightCoverage,
  trends,
}: {
  mode: 'live' | 'historical';
  chartData: LivePoint[];
  sunMarkers?: { time: string; label: string }[];
  overallSolarCoverage: number | null;
  currentSolarShare?: number;
  currentGridDraw?: number;
  historicalHoursAboveThreshold?: number | null;
  historicalDaylightCoverage?: number | null;
  trends?: Partial<Record<string, TrendIndicatorData>>;
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

  const firstStatLabel = mode === 'historical' ? 'Hours >80% Solar' : 'Current Solar Coverage';
  const secondStatLabel = mode === 'historical' ? "Day's Total Coverage" : "Today's Total Coverage";
  const thirdStatLabel = mode === 'historical' ? 'Daylight Hours Coverage' : 'Current Grid Draw';

  const firstStatValue =
    mode === 'historical'
      ? historicalHoursAboveThreshold != null
        ? `${Number.isInteger(historicalHoursAboveThreshold) ? historicalHoursAboveThreshold.toFixed(0) : historicalHoursAboveThreshold.toFixed(1)}h`
        : '—'
      : `${currentSolarShare ?? 0}%`;

  const thirdStatValue =
    mode === 'historical'
      ? historicalDaylightCoverage != null
        ? `${historicalDaylightCoverage}%`
        : '—'
      : `${currentGridDraw ?? 100}%`;

  const coverageSunMarkers = useMemo(
    () => sunMarkers?.filter((marker) => marker.label !== 'Solar noon'),
    [sunMarkers],
  );

  const coverageOption = useMemo(
    () => buildCoverageOption(coverageData, coverageSunMarkers),
    [coverageData, coverageSunMarkers],
  );

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
            notMerge={false}
          />
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{firstStatLabel}</p>
          <div className="mt-auto pt-1 flex items-baseline justify-between gap-1">
            <p className="font-mono text-lg font-semibold text-amber-300">{firstStatValue}</p>
            {trends && <TrendPill trend={trends.current_solar_coverage} />}
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {secondStatLabel}
          </p>
          <div className="mt-auto pt-1 flex items-baseline justify-between gap-1">
            <p className="font-mono text-lg font-semibold text-emerald-300">
              {overallSolarCoverage !== null ? `${overallSolarCoverage}%` : '—'}
            </p>
            {trends && <TrendPill trend={trends.overall_solar_coverage} />}
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{thirdStatLabel}</p>
          <div className="mt-auto pt-1 flex items-baseline justify-between gap-1">
            <p className="font-mono text-lg font-semibold text-slate-300">{thirdStatValue}</p>
            {trends && <TrendPill trend={trends.current_grid_draw} />}
          </div>
        </div>
      </div>
    </div>
  );
}
