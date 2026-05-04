'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RangeSeriesDay } from '@/src/range/types';
import type { RepaymentSchedule } from '@/src/range/recovery';
import {
  CALENDAR_METRICS,
  normalizeSeries,
  formatDayValue,
  extractExportCredit,
  extractImmersionValue,
  findBestDates,
  getMetricHue,
  interpolateBarColor,
  type NormalizedDay,
} from '@/src/calendar/metrics';
import type { CalendarMetric } from '@/src/calendar/types';
import { buildHeatMapCells, buildMonthLabels, totalColumns, buildHistoryDayUrl, buildCalendarYearUrl } from '@/src/range/heatmapGrid';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_LABELS: { row: number; label: string }[] = [
  { row: 0, label: 'Mon' },
  { row: 2, label: 'Wed' },
  { row: 4, label: 'Fri' },
];

const CELL_SIZE = 15; // px
const CELL_GAP = 3;  // px
const ROW_LABEL_WIDTH = 32; // px

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type YearHeatMapProps = {
  series: RangeSeriesDay[];
  year: number;
  today: string;
  repaymentSchedules: RepaymentSchedule[];
  currency: string;
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function YearHeatMap({ series, year, today, repaymentSchedules, currency }: YearHeatMapProps) {
  const router = useRouter();
  const [activeMetric, setActiveMetric] = useState<CalendarMetric>('generation_kwh');
  const [tooltip, setTooltip] = useState<{
    date: string;
    rawValue: number | null;
    secondaryFormatted?: string;
    message?: string;
    x: number;
    y: number;
  } | null>(null);

  const normalizedMap = useMemo<Map<string, NormalizedDay>>(() => {
    const normalized = normalizeSeries(series, activeMetric, repaymentSchedules);
    return new Map(normalized.map((d) => [d.date, d]));
  }, [series, activeMetric, repaymentSchedules]);

  const cells = useMemo(() => buildHeatMapCells(year), [year]);
  const monthLabels = useMemo(() => buildMonthLabels(year), [year]);
  const numCols = useMemo(() => totalColumns(year), [year]);

  const metricHue = getMetricHue(activeMetric);

  const bestDates = useMemo(
    () => findBestDates([...normalizedMap.values()], activeMetric),
    [normalizedMap, activeMetric],
  );

  const bestDayLabel = useMemo(() => {
    if (bestDates.size === 0) return null;
    const firstBestDate = [...bestDates].sort()[0];
    const normalized = normalizedMap.get(firstBestDate);
    if (!normalized || normalized.rawValue === null) return null;
    const primary = formatDayValue(normalized.rawValue, activeMetric, currency);
    const bestDay = series.find((d) => d.date === firstBestDate);
    const formatSecondary = (v: number) => new Intl.NumberFormat('en-IE', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v);
    if (activeMetric === 'export_kwh') {
      const credit = bestDay ? extractExportCredit(bestDay) : null;
      if (credit !== null) return `${formatDayMD(firstBestDate)} (${primary} | ${formatSecondary(credit)})`;
    }
    if (activeMetric === 'immersion_kwh') {
      const value = bestDay ? extractImmersionValue(bestDay) : null;
      if (value !== null) return `${formatDayMD(firstBestDate)} (${primary} | ${formatSecondary(value)})`;
    }
    return `${formatDayMD(firstBestDate)} (${primary})`;
  }, [bestDates, normalizedMap, activeMetric, currency, series]);

  const yearSummary = useMemo((): { value: string; secondaryValue?: string; label: string } | null => {
    const metricLabel = CALENDAR_METRICS.find((m) => m.id === activeMetric)?.label ?? '';
    const baseLabel = `${metricLabel} — ${year} total`;

    if (activeMetric === 'solar_coverage') {
      let sum = 0; let count = 0;
      for (const d of normalizedMap.values()) {
        if (d.rawValue !== null && d.rawValue >= 0) { sum += d.rawValue; count++; }
      }
      if (count === 0) return null;
      return { value: formatDayValue(sum / count, 'solar_coverage', currency), label: `${metricLabel} — ${year} average` };
    }

    if (activeMetric === 'prorata_coverage') {
      let count = 0; let evaluable = 0;
      for (const d of normalizedMap.values()) {
        if (d.rawValue !== null) {
          evaluable++;
          if (d.rawValue >= 1.0) count++;
        }
      }
      const pct = evaluable > 0 ? Math.round((count / evaluable) * 100) : 0;
      const value = evaluable > 0
        ? `${count} day${count !== 1 ? 's' : ''}, ${pct}%`
        : `${count} day${count !== 1 ? 's' : ''}`;
      return { value, label: 'Days that covered pro-rata payments' };
    }

    let sum = 0; let hasAny = false;
    for (const d of normalizedMap.values()) {
      if (d.rawValue !== null && d.rawValue >= 0) { sum += d.rawValue; hasAny = true; }
    }
    if (!hasAny) return null;

    const formatCurrencyVal = (v: number) => new Intl.NumberFormat('en-IE', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v);

    if (activeMetric === 'export_kwh') {
      let creditSum = 0;
      for (const day of series) {
        const c = extractExportCredit(day);
        if (c !== null) creditSum += c;
      }
      return { value: formatDayValue(sum, activeMetric, currency), secondaryValue: formatCurrencyVal(creditSum), label: baseLabel };
    }

    if (activeMetric === 'immersion_kwh') {
      let valueSum = 0;
      for (const day of series) {
        const v = extractImmersionValue(day);
        if (v !== null) valueSum += v;
      }
      if (valueSum > 0) {
        return { value: formatDayValue(sum, activeMetric, currency), secondaryValue: formatCurrencyVal(valueSum), label: baseLabel };
      }
    }

    return { value: formatDayValue(sum, activeMetric, currency), label: baseLabel };
  }, [normalizedMap, series, activeMetric, currency, year]);

  const handleCellEnter = useCallback(
    (e: React.MouseEvent, date: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = rect.left;
      const y = rect.top;

      const normalized = normalizedMap.get(date);
      if (!normalized || normalized.rawValue === null) {
        const descriptor = CALENDAR_METRICS.find((m) => m.id === activeMetric);
        const day = series.find((d) => d.date === date);
        let message = 'No data';
        if (day?.hasSummary && descriptor?.requiresTariff && !day.billing) {
          message = 'No tariff';
        } else if (descriptor?.requiresFinance && repaymentSchedules.length === 0) {
          message = 'No finance data';
        }
        setTooltip({ date, rawValue: null, message, x, y });
        return;
      }

      let secondaryFormatted: string | undefined;
      const day = series.find((d) => d.date === date);
      const formatCurrency = (v: number) => new Intl.NumberFormat('en-IE', {
        style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(v);
      if (activeMetric === 'export_kwh') {
        const credit = day ? extractExportCredit(day) : null;
        if (credit !== null) secondaryFormatted = formatCurrency(credit);
      } else if (activeMetric === 'immersion_kwh') {
        const value = day ? extractImmersionValue(day) : null;
        if (value !== null) secondaryFormatted = formatCurrency(value);
      }
      setTooltip({ date, rawValue: normalized.rawValue, secondaryFormatted, x, y });
    },
    [normalizedMap, activeMetric, series, repaymentSchedules, currency],
  );

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  const handleCellClick = useCallback(
    (date: string, isFuture: boolean) => {
      if (isFuture) return;
      router.push(buildHistoryDayUrl(date));
    },
    [router],
  );

  // Build a lookup by date for fast access
  const cellByDate = useMemo(() => {
    const map = new Map<string, { col: number; row: number }>();
    for (const c of cells) map.set(c.date, { col: c.col, row: c.row });
    return map;
  }, [cells]);

  const totalWidth = numCols * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const totalHeight = 7 * (CELL_SIZE + CELL_GAP) - CELL_GAP;

  return (
    <div
      className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-3 sm:p-5"
      onClick={() => setTooltip(null)}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {year} Heatmap
        </span>
      </div>

      {/* Metric strip */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CALENDAR_METRICS.map((m) => (
          <button
            key={m.id}
            onClick={(e) => { e.stopPropagation(); setActiveMetric(m.id); }}
            className={[
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeMetric === m.id
                ? 'border-indigo-500 bg-indigo-600/80 text-white'
                : 'border-slate-600 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-100',
            ].join(' ')}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Year summary headline */}
      {yearSummary && (
        <div className="mb-4 flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400">{yearSummary.label}</span>
          <span className="text-sm font-semibold tabular-nums text-slate-100">{yearSummary.value}</span>
          {yearSummary.secondaryValue && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-sm font-semibold tabular-nums text-slate-100">{yearSummary.secondaryValue}</span>
            </>
          )}
          {bestDayLabel && (
            <>
              <span className="text-xs font-medium text-slate-400">· Best day</span>
              <span className="text-sm font-semibold tabular-nums text-slate-100">{bestDayLabel}</span>
            </>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="flex justify-center">
        <div style={{ minWidth: ROW_LABEL_WIDTH + totalWidth }}>
          {/* Month label row */}
          <div className="flex mb-1" style={{ paddingLeft: ROW_LABEL_WIDTH }}>
            <div className="relative" style={{ width: totalWidth, height: 16 }}>
              {monthLabels.map(({ month, label, col }) => (
                <span
                  key={month}
                  className="absolute text-[10px] font-medium text-slate-400 leading-none"
                  style={{ left: col * (CELL_SIZE + CELL_GAP) }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Day-of-week labels + grid rows */}
          <div className="flex gap-0">
            {/* Row labels column */}
            <div
              className="shrink-0 flex flex-col"
              style={{ width: ROW_LABEL_WIDTH, gap: CELL_GAP }}
            >
              {Array.from({ length: 7 }, (_, row) => {
                const labelEntry = ROW_LABELS.find((r) => r.row === row);
                return (
                  <div
                    key={row}
                    className="flex items-center justify-end pr-1 text-[10px] font-medium text-slate-400 leading-none"
                    style={{ height: CELL_SIZE }}
                  >
                    {labelEntry?.label ?? ''}
                  </div>
                );
              })}
            </div>

            {/* Heat map cells */}
            <div
              className="relative shrink-0"
              style={{ width: totalWidth, height: totalHeight }}
            >
              {cells.map(({ date, col, row }) => {
                const isFuture = date > today;
                const normalized = normalizedMap.get(date);
                const hasData = !isFuture && normalized && normalized.normalizedHeight !== null;
                const height = hasData ? normalized!.normalizedHeight! : null;

                const x = col * (CELL_SIZE + CELL_GAP);
                const y = row * (CELL_SIZE + CELL_GAP);

                let bg: string;
                if (isFuture) {
                  bg = 'rgba(30, 41, 59, 0.25)';
                } else if (hasData && height !== null) {
                  bg = interpolateBarColor(metricHue, height);
                } else {
                  bg = 'rgba(30, 41, 59, 0.5)';
                }

                const cellStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 2,
                  backgroundColor: bg,
                  cursor: isFuture ? 'default' : (hasData ? 'pointer' : 'default'),
                  transition: 'background-color 300ms ease',
                };

                const isBestDay = hasData && bestDates.has(date);
                if (isBestDay) {
                  cellStyle.outline = '1px solid rgba(255, 255, 255, 0.45)';
                  cellStyle.outlineOffset = '1px';
                  cellStyle.boxShadow = '0 0 4px rgba(255, 255, 255, 0.15)';
                  cellStyle.zIndex = 1;
                }

                if (isFuture) {
                  return <div key={date} style={cellStyle} />;
                }

                return (
                  <div
                    key={date}
                    style={cellStyle}
                    className={hasData ? 'hover:opacity-75 transition-opacity' : undefined}
                    onMouseEnter={(e) => { e.stopPropagation(); handleCellEnter(e, date); }}
                    onMouseLeave={handleCellLeave}
                    onClick={(e) => { e.stopPropagation(); handleCellClick(date, isFuture); }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Footer: legend + calendar link */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <ColorLegend metricHue={metricHue} />
        <Link
          href={buildCalendarYearUrl(year)}
          className="shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View detailed calendar view for {year}
        </Link>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <HeatMapTooltip
          date={tooltip.date}
          rawValue={tooltip.rawValue}
          secondaryFormatted={tooltip.secondaryFormatted}
          message={tooltip.message}
          metric={activeMetric}
          currency={currency}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

const LEGEND_STEPS = [0, 0.25, 0.5, 0.75, 1];

function ColorLegend({ metricHue }: { metricHue: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-500">Less</span>
      {LEGEND_STEPS.map((t) => (
        <div
          key={t}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            borderRadius: 2,
            backgroundColor: t === 0 ? 'rgba(30, 41, 59, 0.5)' : interpolateBarColor(metricHue, t),
          }}
        />
      ))}
      <span className="text-[10px] text-slate-500">More</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function HeatMapTooltip({
  date,
  rawValue,
  secondaryFormatted,
  message,
  metric,
  currency,
  x,
  y,
}: {
  date: string;
  rawValue: number | null;
  secondaryFormatted?: string;
  message?: string;
  metric: CalendarMetric;
  currency: string;
  x: number;
  y: number;
}) {
  const formatted = rawValue !== null ? formatDayValue(rawValue, metric, currency) : null;
  const safeX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 184) : x;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-slate-700 bg-[#131f30] px-3 py-2 text-xs shadow-xl"
      style={{ left: safeX, top: Math.max(8, y - 56) }}
    >
      <p className="font-medium text-slate-300">{formatDateLabel(date)}</p>
      {message ? (
        <p className="mt-0.5 text-slate-500">{message}</p>
      ) : secondaryFormatted ? (
        <p className="mt-0.5 font-mono font-semibold text-slate-100">
          {formatted} <span className="text-slate-500">|</span> {secondaryFormatted}
        </p>
      ) : (
        <p className="mt-0.5 font-mono font-semibold text-slate-100">{formatted}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
}

function formatDayMD(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
