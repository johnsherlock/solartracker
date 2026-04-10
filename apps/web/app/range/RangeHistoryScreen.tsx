'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  Info,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { RangeSummaryPayload, RangeSeriesDay } from '@/src/range/types';
import {
  type ActiveRange,
  formatRangeLabel,
  stepRangeForward,
  stepRangeBackward,
  isStepForwardDisabled,
  isStepBackwardDisabled,
  defaultActiveRange,
  loadedWindowStart,
} from '@/src/range/presets';
import {
  aggregateKpisFromSeries,
  formatCurrency,
  formatPercent,
} from '@/src/range/kpi';
import { EnergyTrendChart } from './EnergyTrendChart';
import { PerDayBarChart } from './PerDayBarChart';
import { CostHistogramChart } from './CostHistogramChart';
import { PeriodCostDonutChart } from './PeriodCostDonutChart';
import { RangePickerPopover } from './RangePickerPopover';
import { SolarCoverageChart } from './SolarCoverageChart';
import { ExportRatioChart } from './ExportRatioChart';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type RangeHistoryScreenProps = {
  payload: RangeSummaryPayload | null;
  today: string;
  financeMode: string | null;
  monthlyFinancePaymentAmount: number | null;
  financeTermMonths: number | null;
  initialMode: string | null;
  error: boolean;
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

export function RangeHistoryScreen({ payload, today, financeMode, monthlyFinancePaymentAmount, financeTermMonths, initialMode, error }: RangeHistoryScreenProps) {
  const router = useRouter();

  const earliestDate = payload?.meta.earliestDate ?? null;
  const loadedFrom = payload?.meta.from ?? loadedWindowStart(today);

  const [activeRange, setActiveRange] = useState<ActiveRange>(() => {
    if (initialMode === 'all') {
      const from = earliestDate ?? loadedWindowStart(today);
      return { mode: 'all', from, to: today };
    }
    return defaultActiveRange(today);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tariffCalloutDismissed, setTariffCalloutDismissed] = useState(false);

  // ---------------------------------------------------------------------------
  // Effective range clamped to what's loaded server-side
  // ---------------------------------------------------------------------------
  const effectiveRange = useMemo((): ActiveRange => {
    if (activeRange.mode === 'all') {
      // If earliestDate is before loaded window, we trigger a URL-based reload
      // (handled in handleRangeChange below). For rendering purposes, use the
      // loaded window start as the floor.
      return {
        ...activeRange,
        from: activeRange.from < loadedFrom ? loadedFrom : activeRange.from,
      };
    }
    return activeRange;
  }, [activeRange, loadedFrom]);

  const filteredSeries = useMemo(() => {
    if (!payload) return [];
    return payload.series.filter(
      (d) => d.date >= effectiveRange.from && d.date <= effectiveRange.to,
    );
  }, [payload, effectiveRange]);

  const kpis = useMemo(() => {
    if (!payload) return null;
    return aggregateKpisFromSeries(filteredSeries, effectiveRange.from, effectiveRange.to);
  }, [payload, filteredSeries, effectiveRange]);

  const isFinanced = financeMode === 'finance';

  // ---------------------------------------------------------------------------
  // Range change handler — triggers navigation for "All" when needed
  // ---------------------------------------------------------------------------
  function handleRangeChange(range: ActiveRange) {
    if (range.mode === 'all' && earliestDate && earliestDate < loadedFrom) {
      // Full history needed; reload page with ?mode=all
      router.push('/range?mode=all');
      return;
    }
    setActiveRange(range);
  }

  // ---------------------------------------------------------------------------
  // Chevron state
  // ---------------------------------------------------------------------------
  const fwdDisabled = isStepForwardDisabled(activeRange, today);
  const bwdDisabled = isStepBackwardDisabled(activeRange, earliestDate);

  function handleStepForward() {
    if (!fwdDisabled) setActiveRange((r) => stepRangeForward(r, today));
  }

  function handleStepBackward() {
    if (bwdDisabled) return;
    const next = stepRangeBackward(activeRange, earliestDate);
    if (next.from < loadedFrom && earliestDate && earliestDate < loadedFrom) {
      router.push('/range?mode=all');
      return;
    }
    setActiveRange(next);
  }

  const health = payload?.health;
  const hasTariffChange = useMemo(() => {
    const ids = new Set(filteredSeries.map((d) => d.tariffVersionId).filter(Boolean));
    return ids.size > 1 && !tariffCalloutDismissed;
  }, [filteredSeries, tariffCalloutDismissed]);
  const hasMissing = (kpis?.missingDays ?? 0) > 0;
  const hasPartial = (kpis?.partialDays ?? 0) > 0;
  const showCompletenessBanner = hasMissing || hasPartial;

  const lastCoveredDate = payload
    ? [...payload.series].reverse().find((d) => d.hasSummary)?.date ?? null
    : null;

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">

      {/* ------------------------------------------------------------------ */}
      {/* Nav bar — sticky layer 1                                            */}
      {/* ------------------------------------------------------------------ */}
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
              <BarChart3 size={14} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-100">Range History</span>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
            J
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* §1 — Period selector — sticky layer 2                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          {/* Period bar: [<] [label] [>] */}
          <div className="relative flex items-center justify-center gap-3">
            {/* Back chevron */}
            <button
              onClick={handleStepBackward}
              disabled={bwdDisabled}
              aria-label="Step backward"
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                bwdDisabled
                  ? 'border-slate-800 text-slate-700 cursor-default opacity-40'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Label / picker trigger */}
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="min-w-[140px] rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:text-white sm:min-w-[180px]"
            >
              {formatRangeLabel(activeRange)}
            </button>

            {/* Forward chevron */}
            <button
              onClick={handleStepForward}
              disabled={fwdDisabled}
              aria-label="Step forward"
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                fwdDisabled
                  ? 'border-slate-800 text-slate-700 cursor-default opacity-40'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
            >
              <ChevronRight size={14} />
            </button>

            {/* Range picker popover */}
            {pickerOpen && (
              <RangePickerPopover
                today={today}
                earliestDate={earliestDate}
                activeRange={activeRange}
                onRangeChange={handleRangeChange}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>

          {/* Trust strip */}
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
            {lastCoveredDate ? `Data through ${formatDate(lastCoveredDate)}` : 'No data loaded'}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">

        {/* Hard error */}
        {error && <HardErrorCard />}

        {!error && (
          <>
            {/* Empty */}
            {kpis && kpis.coveredDays === 0 && (
              <EmptyCard from={effectiveRange.from} to={effectiveRange.to} />
            )}

            {kpis && kpis.coveredDays > 0 && (
              <>
                {/* §2 — KPI row */}
                <KpiRow
                  kpis={kpis}
                  currency={payload?.meta.currency ?? 'EUR'}
                  note={payload?.summary.note}
                />

                {/* §3 — Tariff-change callout */}
                {hasTariffChange && (
                  <TariffChangeCallout
                    series={filteredSeries}
                    onDismiss={() => setTariffCalloutDismissed(true)}
                  />
                )}

                {/* Completeness strip */}
                {showCompletenessBanner && (
                  <CompletenessStrip
                    missingDays={kpis.missingDays}
                    partialDays={kpis.partialDays}
                    tariffGapDays={kpis.tariffGapDays}
                    coveredDays={kpis.coveredDays}
                  />
                )}

                {/* §4–§9 Charts */}
                <ChartPlaceholders
                  hasTariff={kpis.hasTariff}
                  series={filteredSeries}
                  note={payload?.summary.note}
                  currency={payload?.meta.currency ?? 'EUR'}
                />

                {/* §10 — Payback tracker (financed installations only) */}
                {isFinanced && (
                  <PaybackTracker
                    periodSavings={kpis.savings}
                    periodDays={filteredSeries.length}
                    monthlyPayment={monthlyFinancePaymentAmount}
                    termMonths={financeTermMonths}
                    currency={payload?.meta.currency ?? 'EUR'}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §2 — KPI row
// ---------------------------------------------------------------------------

type KpiRowProps = {
  kpis: ReturnType<typeof aggregateKpisFromSeries>;
  currency: string;
  note?: 'banded-daily-rate' | 'simplified-daily-rate';
};

function KpiRow({ kpis, currency, note }: KpiRowProps) {
  if (!kpis.hasTariff) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-700 bg-[#111b2b] p-6 text-center">
        <p className="mb-1 text-sm font-semibold text-slate-300">Add a tariff to see cost and savings</p>
        <p className="mb-4 text-xs text-slate-500">
          Energy charts are still available below. Financial data requires a tariff to be configured.
        </p>
        <Link
          href="/tariffs"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          Set up tariff →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {kpis.tariffGapDays > 0 && (
        <p className="text-xs text-slate-500">
          Financial data covers {kpis.coveredDays - kpis.tariffGapDays} of {kpis.coveredDays} days.{' '}
          <Link href="/tariffs" className="text-indigo-400 hover:underline">
            Add tariff history to extend coverage.
          </Link>
        </p>
      )}
      {note === 'simplified-daily-rate' && (
        <p className="text-[11px] text-slate-500">Cost calculated using day rate only</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Solar savings" value={formatCurrency(kpis.savings, currency)} highlight />
        <KpiCard label="Actual cost" value={formatCurrency(kpis.actualNetCost, currency)} />
        <KpiCard label="Without solar" value={formatCurrency(kpis.withoutSolarNetCost, currency)} />
        <KpiCard label="Export credit" value={formatCurrency(kpis.actualExportCredit, currency)} />
        <KpiCard
          label="Avg solar coverage"
          value={kpis.avgSelfConsumptionRatio != null ? formatPercent(kpis.avgSelfConsumptionRatio) : '—'}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight = false,
  className = '',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-4 shadow-[0_24px_50px_rgba(2,6,23,0.28)]',
        highlight
          ? 'border-indigo-500/30 bg-indigo-900/30'
          : 'border-slate-800 bg-slate-900/75',
        className,
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={[
        'mt-3 font-mono text-2xl font-semibold tracking-tight',
        highlight ? 'text-indigo-200' : 'text-slate-50',
      ].join(' ')}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §3 — Tariff-change callout
// ---------------------------------------------------------------------------

function TariffChangeCallout({
  series,
  onDismiss,
}: {
  series: RangeSeriesDay[];
  onDismiss: () => void;
}) {
  const versionCount = new Set(series.map((d) => d.tariffVersionId).filter(Boolean)).size;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
      <p className="flex-1 text-sm text-amber-300/90">
        <span className="font-semibold text-amber-200">Tariff changed during this period</span>
        {' — '}
        {versionCount} tariff version{versionCount !== 1 ? 's' : ''} applied.
        Financial totals reflect each day's applicable rate.
      </p>
      <button onClick={onDismiss} className="shrink-0 text-amber-500/50 hover:text-amber-400">
        <X size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completeness strip
// ---------------------------------------------------------------------------

function CompletenessStrip({
  missingDays,
  partialDays,
  tariffGapDays,
  coveredDays,
}: {
  missingDays: number;
  partialDays: number;
  tariffGapDays: number;
  coveredDays: number;
}) {
  const parts: string[] = [];
  if (missingDays > 0)
    parts.push(
      `${missingDays} day${missingDays !== 1 ? 's' : ''} in this range ${missingDays !== 1 ? 'have' : 'has'} no data and ${missingDays !== 1 ? 'are' : 'is'} excluded from totals.`,
    );
  if (partialDays > 0)
    parts.push(`${partialDays} day${partialDays !== 1 ? 's are' : ' is'} partial.`);

  return (
    <div className="flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
      <Info size={12} className="mt-0.5 shrink-0 text-slate-600" />
      <span>{parts.join(' ')}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyCard({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-800 bg-[#111b2b] py-20 text-center">
      <BarChart3 size={28} className="mb-4 text-slate-700" />
      <p className="mb-1 text-sm font-semibold text-slate-400">No data for this period</p>
      <p className="text-xs text-slate-600">
        No summaries found between {formatDate(from)} and {formatDate(to)}.
        Check the Data Health screen if you expected data here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hard error
// ---------------------------------------------------------------------------

function HardErrorCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-rose-800/30 bg-rose-950/20 py-20 text-center">
      <AlertTriangle size={28} className="mb-4 text-rose-600" />
      <p className="mb-1 text-sm font-semibold text-slate-300">Something went wrong loading this period</p>
      <p className="mb-5 text-xs text-slate-500">Try refreshing the page.</p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 hover:text-slate-100"
      >
        <RefreshCw size={12} />
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §4–§9 Chart placeholder cards
// ---------------------------------------------------------------------------

function ChartPlaceholders({
  hasTariff,
  series,
  note,
  currency,
}: {
  hasTariff: boolean;
  series: RangeSeriesDay[];
  note?: 'banded-daily-rate' | 'simplified-daily-rate';
  currency: string;
}) {
  // Incrementing this key forces charts to remount, which reliably clears zoom state.
  const [resetKey, setResetKey] = useState(0);
  const resetCharts = useCallback(() => setResetKey((k) => k + 1), []);

  const hasGeneration = useMemo(
    () => series.some((d) => d.hasSummary && d.generatedKwh > 0),
    [series],
  );


  const periodCostTotals = useMemo(() => {
    let importCost = 0;
    let fixedCharges = 0;
    let exportCredit = 0;
    let savings = 0;
    for (const d of series) {
      if (!d.hasSummary || !d.billing) continue;
      importCost += d.billing.importCost;
      fixedCharges += d.billing.fixedCharges;
      exportCredit += d.billing.exportCredit;
      savings += d.billing.savings;
    }
    return {
      importCost: Math.round(importCost * 100) / 100,
      fixedCharges: Math.round(fixedCharges * 100) / 100,
      exportCredit: Math.round(exportCredit * 100) / 100,
      savings: Math.round(savings * 100) / 100,
    };
  }, [series]);

  return (
    <>
      <ChartCard title="Energy trend" icon={<TrendingUp size={14} />} onReset={resetCharts}>
        <EnergyTrendChart key={resetKey} series={series} />
      </ChartCard>
      <ChartCard title="Per-day breakdown" icon={<BarChart3 size={14} />} onReset={resetCharts}>
        <PerDayBarChart key={resetKey} series={series} />
      </ChartCard>
      {hasTariff ? (
        <>
          <ChartCard title="Daily cost vs without solar" icon={<BarChart3 size={14} />} onReset={resetCharts}>
            <CostHistogramChart key={resetKey} series={series} currency={currency} />
          </ChartCard>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ChartCard title="Period cost breakdown" icon={<Zap size={14} />}>
              <PeriodCostDonutChart
                totals={periodCostTotals}
                simplified={note === 'simplified-daily-rate'}
                currency={currency}
              />
            </ChartCard>
            {hasGeneration && (
              <ChartCard title="Export ratio" icon={<TrendingUp size={14} />} onReset={resetCharts}>
                <ExportRatioChart key={resetKey} series={series} />
              </ChartCard>
            )}
          </div>
        </>
      ) : (
        <NoTariffCard />
      )}
      <ChartCard title="Solar coverage" icon={<Zap size={14} />} onReset={resetCharts}>
        <SolarCoverageChart key={resetKey} series={series} />
      </ChartCard>
    </>
  );
}

function NoTariffCard() {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-800 bg-[#111b2b] px-5 py-8 text-center">
      <Zap size={20} className="mx-auto mb-3 text-slate-700" />
      <p className="mb-1 text-sm font-semibold text-slate-400">Add a tariff to see financial breakdowns</p>
      <p className="mb-4 text-xs text-slate-600">Cost histogram and period breakdown require tariff data.</p>
      <Link
        href="/tariffs"
        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
      >
        Set up tariff →
      </Link>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  onReset,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onReset?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-slate-600">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</span>
        {onReset && (
          <button
            onClick={onReset}
            title="Reset zoom"
            className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-500 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            <RotateCcw size={11} />
            Reset zoom
          </button>
        )}
      </div>
      {children ?? (
        <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-800/80 text-[11px] text-slate-700">
          Chart coming in U-043 / U-044
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §10 — Payback tracker (financed installations only)
// ---------------------------------------------------------------------------

const AVG_DAYS_PER_MONTH = 30.4375;

function PaybackTracker({
  periodSavings,
  periodDays,
  monthlyPayment,
  termMonths,
  currency,
}: {
  periodSavings: number;
  periodDays: number;
  monthlyPayment: number | null;
  termMonths: number | null;
  currency: string;
}) {
  if (!monthlyPayment || monthlyPayment <= 0) return null;

  const periodPayments = Math.round((monthlyPayment * periodDays / AVG_DAYS_PER_MONTH) * 100) / 100;
  const isPositive = periodSavings >= periodPayments;
  const fillPct = periodPayments > 0
    ? Math.min(100, Math.round((periodSavings / periodPayments) * 100))
    : 0;

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-slate-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payback progress</span>
        {termMonths && (
          <span className="ml-auto text-[11px] text-slate-600">
            {termMonths}-month finance term · {formatCurrency(monthlyPayment, currency)}/mo
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={[
            'h-full rounded-full transition-all duration-500',
            isPositive ? 'bg-emerald-500' : 'bg-slate-600',
          ].join(' ')}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-slate-400">
          Solar saved{' '}
          <span className={isPositive ? 'font-semibold text-emerald-400' : 'font-semibold text-slate-300'}>
            {formatCurrency(periodSavings, currency)}
          </span>
          {' '}of your{' '}
          <span className="text-slate-300">{formatCurrency(periodPayments, currency)}</span>
          {' '}in payments this period
        </p>
        <span
          className={[
            'shrink-0 pl-4 text-xs font-semibold tabular-nums',
            isPositive ? 'text-emerald-400' : 'text-slate-500',
          ].join(' ')}
        >
          {fillPct}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
}
