'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import type { RangeSummaryPayload, RangeSeriesDay } from '@/src/range/types';
import type { RepaymentSchedule } from '@/src/range/recovery';
import { getCachedYear, setCachedYear, fetchOrGetYear } from '@/src/calendar/yearCache';
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
import { WarningsCallout } from '@/src/components/WarningsCallout';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CalendarScreenProps = {
  payload: RangeSummaryPayload | null;
  year: number;
  today: string;
  earliestDate: string | null;
  repaymentSchedules: RepaymentSchedule[];
  currency: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NUMBERS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Returns days in the given month (1-based) for the given year. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Returns YYYY-MM-DD or null if the date is not a valid calendar date. */
function isoDate(year: number, month: number, day: number): string | null {
  if (day > daysInMonth(year, month)) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function buildMonthRangeUrl(year: number, month: number): string {
  const mm = String(month).padStart(2, '0');
  const lastDay = daysInMonth(year, month);
  const dd = String(lastDay).padStart(2, '0');
  return `/range?from=${year}-${mm}-01&to=${year}-${mm}-${dd}&mode=months`;
}

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

export function CalendarScreen({
  payload: initialPayload,
  year: initialYear,
  today,
  earliestDate: initialEarliestDate,
  repaymentSchedules,
  currency,
}: CalendarScreenProps) {
  const router = useRouter();

  const [activeYear, setActiveYear] = useState(initialYear);
  const [activeSeries, setActiveSeries] = useState<RangeSeriesDay[]>(
    initialPayload?.series ?? [],
  );
  const [earliestDate, setEarliestDate] = useState(initialEarliestDate);
  const [activeMetric, setActiveMetric] = useState<CalendarMetric>('generation_kwh');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialPayload === null);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  const [tooltip, setTooltip] = useState<{
    date: string;
    rawValue: number | null;
    secondaryFormatted?: string;
    message?: string;
    x: number;
    y: number;
  } | null>(null);

  const currentYear = parseInt(today.slice(0, 4), 10);
  const earliestYear = earliestDate ? parseInt(earliestDate.slice(0, 4), 10) : currentYear;

  // Seed the cache with the server-loaded payload on mount.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialPayload) return;
    seededRef.current = true;
    setCachedYear(String(initialYear), initialPayload);
  }, [initialPayload, initialYear]);

  // ---------------------------------------------------------------------------
  // Year navigation
  // ---------------------------------------------------------------------------

  const navigateYear = useCallback(
    async (newYear: number) => {
      if (newYear === activeYear) return;
      setLoading(true);
      setError(false);
      setTooltip(null);

      // Update URL immediately.
      window.history.replaceState(null, '', `/calendar?year=${newYear}`);

      try {
        const payload = await fetchOrGetYear(String(newYear));
        setActiveSeries(payload.series);
        if (payload.meta.earliestDate) {
          setEarliestDate(payload.meta.earliestDate);
        }
        setActiveYear(newYear);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [activeYear],
  );

  // Retry load for the active year — navigateYear short-circuits on same-year.
  const retryCurrentYear = useCallback(async () => {
    setLoading(true);
    setError(false);
    setTooltip(null);
    try {
      const payload = await fetchOrGetYear(String(activeYear));
      setActiveSeries(payload.series);
      if (payload.meta.earliestDate) setEarliestDate(payload.meta.earliestDate);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeYear]);

  // Reset warnings banner when year changes.
  useEffect(() => { setWarningsDismissed(false); }, [activeYear]);

  // Also pre-warm the adjacent year when idle.
  useEffect(() => {
    const nextYear = activeYear + 1;
    const prevYear = activeYear - 1;
    if (nextYear <= currentYear && !getCachedYear(String(nextYear))) {
      fetchOrGetYear(String(nextYear)).catch(() => {});
    }
    if (prevYear >= earliestYear && !getCachedYear(String(prevYear))) {
      fetchOrGetYear(String(prevYear)).catch(() => {});
    }
  }, [activeYear, currentYear, earliestYear]);

  // ---------------------------------------------------------------------------
  // Data quality
  // ---------------------------------------------------------------------------

  const dataQuality = useMemo(() => {
    const past = activeSeries.filter((d) => d.date <= today);
    const coveredDays = past.filter((d) => d.hasSummary).length;
    const missingDays = past.filter((d) => !d.hasSummary).length;
    const partialDays = past.filter((d) => d.isPartial).length;
    const hasTariffChange = new Set(past.map((d) => d.tariffVersionId).filter(Boolean)).size > 1;
    return { coveredDays, missingDays, partialDays, hasTariffChange };
  }, [activeSeries, today]);

  // ---------------------------------------------------------------------------
  // Normalization
  // ---------------------------------------------------------------------------

  const normalizedMap = useMemo<Map<string, NormalizedDay>>(() => {
    const normalized = normalizeSeries(activeSeries, activeMetric, repaymentSchedules);
    return new Map(normalized.map((d) => [d.date, d]));
  }, [activeSeries, activeMetric, repaymentSchedules]);

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
    const bestDay = activeSeries.find((d) => d.date === firstBestDate);
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
  }, [bestDates, normalizedMap, activeMetric, currency, activeSeries]);

  // ---------------------------------------------------------------------------
  // Year total
  // ---------------------------------------------------------------------------

  const yearSummary = useMemo((): { value: string; secondaryValue?: string; label: string } | null => {
    const metricLabel = CALENDAR_METRICS.find((m) => m.id === activeMetric)?.label ?? '';
    const baseLabel = `${metricLabel} — ${activeYear} total`;

    if (activeMetric === 'solar_coverage') {
      let sum = 0;
      let count = 0;
      for (const d of normalizedMap.values()) {
        if (d.rawValue !== null && d.rawValue >= 0) { sum += d.rawValue; count++; }
      }
      if (count === 0) return null;
      const avg = sum / count;
      return { value: formatDayValue(avg, 'solar_coverage', currency), label: `${metricLabel} — ${activeYear} average` };
    }

    if (activeMetric === 'prorata_coverage') {
      let count = 0;
      let evaluable = 0;
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

    let sum = 0;
    let hasAny = false;
    for (const d of normalizedMap.values()) {
      if (d.rawValue !== null && d.rawValue >= 0) { sum += d.rawValue; hasAny = true; }
    }
    if (!hasAny) return null;

    const formatCurrencyVal = (v: number) => new Intl.NumberFormat('en-IE', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(v);

    if (activeMetric === 'export_kwh') {
      let creditSum = 0;
      for (const day of activeSeries) {
        const c = extractExportCredit(day);
        if (c !== null) creditSum += c;
      }
      return { value: formatDayValue(sum, activeMetric, currency), secondaryValue: formatCurrencyVal(creditSum), label: baseLabel };
    }

    if (activeMetric === 'immersion_kwh') {
      let valueSum = 0;
      for (const day of activeSeries) {
        const v = extractImmersionValue(day);
        if (v !== null) valueSum += v;
      }
      if (valueSum > 0) {
        return { value: formatDayValue(sum, activeMetric, currency), secondaryValue: formatCurrencyVal(valueSum), label: baseLabel };
      }
    }

    return { value: formatDayValue(sum, activeMetric, currency), label: baseLabel };
  }, [normalizedMap, activeSeries, activeMetric, currency, activeYear]);

  // ---------------------------------------------------------------------------
  // Tooltip handlers
  // ---------------------------------------------------------------------------

  const handleCellEnter = useCallback(
    (e: React.MouseEvent, date: string, normalized: NormalizedDay | undefined) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // Use viewport-relative coords (fixed positioning).
      const x = rect.left;
      const y = rect.top;

      if (!normalized || normalized.rawValue === null) {
        const descriptor = CALENDAR_METRICS.find((m) => m.id === activeMetric);
        const day = activeSeries.find((d) => d.date === date);
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
      const day = activeSeries.find((d) => d.date === date);
      if (activeMetric === 'export_kwh') {
        const credit = day ? extractExportCredit(day) : null;
        if (credit !== null) {
          secondaryFormatted = new Intl.NumberFormat('en-IE', {
            style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
          }).format(credit);
        }
      } else if (activeMetric === 'immersion_kwh') {
        const value = day ? extractImmersionValue(day) : null;
        if (value !== null) {
          secondaryFormatted = new Intl.NumberFormat('en-IE', {
            style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
          }).format(value);
        }
      }
      setTooltip({ date, rawValue: normalized.rawValue, secondaryFormatted, x, y });
    },
    [activeMetric, activeSeries, repaymentSchedules, currency],
  );

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  const prevDisabled = activeYear <= earliestYear;
  const nextDisabled = activeYear >= currentYear;

  return (
    <div
      className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]"
      onClick={() => setTooltip(null)}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Nav bar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
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
              <CalendarDays size={14} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-100">Calendar</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/range"
              title="Range History"
              className="flex h-8 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
            >
              Range History
            </Link>
            <Link
              href="/settings"
              title="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
            >
              <Settings size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Year bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigateYear(activeYear - 1)}
              disabled={prevDisabled || loading}
              aria-label="Previous year"
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                prevDisabled || loading
                  ? 'border-slate-800 text-slate-700 cursor-default opacity-40'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
            >
              <ChevronLeft size={14} />
            </button>

            <Link
              href={`/range?from=${activeYear}-01-01&to=${activeYear}-12-31&mode=years`}
              className="min-w-[80px] rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1.5 text-center text-sm font-semibold text-slate-200 transition-colors hover:border-indigo-500/60 hover:text-white"
            >
              {activeYear}
            </Link>

            <button
              onClick={() => navigateYear(activeYear + 1)}
              disabled={nextDisabled || loading}
              aria-label="Next year"
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                nextDisabled || loading
                  ? 'border-slate-800 text-slate-700 cursor-default opacity-40'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {error && <HardErrorCard onRetry={retryCurrentYear} />}

        {!error && (
          <>
            {/* Data quality warnings */}
            {(dataQuality.missingDays > 0 || dataQuality.partialDays > 0 || dataQuality.hasTariffChange) && !warningsDismissed && (
              <WarningsCallout
                missingDays={dataQuality.missingDays}
                partialDays={dataQuality.partialDays}
                coveredDays={dataQuality.coveredDays}
                hasTariffChange={dataQuality.hasTariffChange}
                series={activeSeries}
                onDismiss={() => setWarningsDismissed(true)}
              />
            )}

            {/* Metric strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {CALENDAR_METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMetric(m.id)}
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

            {/* Year summary */}
            {yearSummary && (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {yearSummary.label}
                </span>
                <span className="font-mono text-lg font-semibold text-slate-100">{yearSummary.value}</span>
                {yearSummary.secondaryValue && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span className="font-mono text-lg font-semibold text-slate-100">{yearSummary.secondaryValue}</span>
                  </>
                )}
                {bestDayLabel && (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">· Best day</span>
                    <span className="font-mono text-lg font-semibold text-slate-100">{bestDayLabel}</span>
                  </>
                )}
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <LoadingState />
            ) : (
              <CalendarGrid
                year={activeYear}
                today={today}
                normalizedMap={normalizedMap}
                bestDates={bestDates}
                activeMetric={activeMetric}
                currency={currency}
                repaymentSchedules={repaymentSchedules}
                activeSeries={activeSeries}
                onCellEnter={handleCellEnter}
                onCellLeave={handleCellLeave}
              />
            )}
          </>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Tooltip                                                             */}
      {/* ------------------------------------------------------------------ */}
      {tooltip && (
        <TooltipPopup
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
// Calendar grid
// ---------------------------------------------------------------------------

type CalendarGridProps = {
  year: number;
  today: string;
  normalizedMap: Map<string, NormalizedDay>;
  bestDates: Set<string>;
  activeMetric: CalendarMetric;
  currency: string;
  repaymentSchedules: RepaymentSchedule[];
  activeSeries: RangeSeriesDay[];
  onCellEnter: (e: React.MouseEvent, date: string, normalized: NormalizedDay | undefined) => void;
  onCellLeave: () => void;
};

function CalendarGrid({
  year,
  today,
  normalizedMap,
  bestDates,
  activeMetric,
  onCellEnter,
  onCellLeave,
}: CalendarGridProps) {
  const metricHue = getMetricHue(activeMetric);
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-4 sm:p-6">
      {/* Day header row */}
      <div className="mb-2 flex">
        {/* Month label spacer */}
        <div className="w-9 shrink-0 sm:w-11" />
        <div className="flex flex-1 gap-1">
          {DAY_NUMBERS.map((d) => (
            <div
              key={d}
              className="flex-1 text-center text-[9px] font-medium text-slate-400 leading-none"
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Month rows */}
      <div className="flex flex-col gap-1.5">
        {MONTH_NAMES.map((monthName, monthIdx) => {
          const month = monthIdx + 1;
          const monthRangeUrl = buildMonthRangeUrl(year, month);

          return (
            <div key={month} className="flex items-end gap-1">
              {/* Month label */}
              <Link
                href={monthRangeUrl}
                className="w-9 shrink-0 pr-1 text-right text-[10px] font-medium text-slate-300 hover:text-indigo-300 transition-colors leading-none pb-0.5 sm:w-11"
              >
                {monthName}
              </Link>

              {/* Day cells — lines span the full row width via the relative wrapper */}
              <div className="relative flex flex-1 gap-1">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-slate-500" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-slate-500" />
                {DAY_NUMBERS.map((day) => {
                  const dateStr = isoDate(year, month, day);

                  if (!dateStr) {
                    // Non-existent date (e.g. Feb 30) — leave fully blank.
                    return <div key={day} className="flex-1 h-16" />;
                  }

                  const isFuture = dateStr > today;
                  const normalized = normalizedMap.get(dateStr);
                  const hasData = normalized && normalized.normalizedHeight !== null;
                  const height = hasData ? normalized.normalizedHeight! : 0;

                  if (isFuture) {
                    // Future valid date — muted stub so users can distinguish from
                    // non-existent dates.
                    return (
                      <div key={day} className="flex-1 h-16 flex items-end">
                        <div className="w-full rounded-t-sm" style={{ height: '2px', backgroundColor: 'rgba(30, 41, 59, 0.35)' }} />
                      </div>
                    );
                  }

                  const isBestDay = dateStr !== null && bestDates.has(dateStr);

                  const cellContent = (
                    <div className="w-full h-16 relative flex items-end">
                      {isBestDay && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center z-10">
                          <span className="text-2xl leading-none select-none">🏆</span>
                        </div>
                      )}
                      <div
                        className="w-full rounded-t-sm transition-all duration-300"
                        style={{
                          height: hasData ? `${Math.max(2, height * 100)}%` : '2px',
                          backgroundColor: hasData
                            ? interpolateBarColor(metricHue, height)
                            : 'rgba(30, 41, 59, 0.4)',
                        }}
                      />
                    </div>
                  );

                  if (hasData) {
                    return (
                      <Link
                        key={day}
                        href={`/history/${dateStr}`}
                        className="flex-1 flex items-end hover:opacity-80 transition-opacity"
                        onMouseEnter={(e) => onCellEnter(e, dateStr, normalized)}
                        onMouseLeave={onCellLeave}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cellContent}
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={day}
                      className="flex-1 flex items-end cursor-default"
                      onMouseEnter={(e) => onCellEnter(e, dateStr, normalized)}
                      onMouseLeave={onCellLeave}
                    >
                      {cellContent}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function TooltipPopup({
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
// Loading state
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center rounded-[28px] border border-slate-800 bg-[#111b2b]">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <RefreshCw size={14} className="animate-spin" />
        Loading year…
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hard error
// ---------------------------------------------------------------------------

function HardErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-rose-800/30 bg-rose-950/20 py-20 text-center">
      <AlertTriangle size={28} className="mb-4 text-rose-600" />
      <p className="mb-1 text-sm font-semibold text-slate-300">Something went wrong loading this year</p>
      <p className="mb-5 text-xs text-slate-500">Try refreshing the page or going back to a previous year.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 hover:text-slate-100"
      >
        <RefreshCw size={12} />
        Try again
      </button>
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

/** Converts an ISO date (YYYY-MM-DD) to DD/MM display format. */
function formatDayMD(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
