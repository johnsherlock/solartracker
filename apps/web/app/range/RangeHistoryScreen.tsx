'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Settings,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { RangeSummaryPayload, RangeSeriesDay } from '@/src/range/types';
import {
  computePayoffOutlook,
  computeRepaymentsForPeriod,
  type RangeFinanceContext,
  type RepaymentSchedule,
} from '@/src/range/recovery';
import {
  type ActiveRange,
  type RangeMode,
  formatRangeLabel,
  stepRangeForward,
  stepRangeBackward,
  isStepForwardDisabled,
  isStepBackwardDisabled,
  defaultActiveRange,
  loadedWindowStart,
  buildRangeUrl,
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
import { RangePickerPopover } from '@/src/components/RangePickerPopover';
import type { NavigationTarget } from '@/src/components/RangePickerPopover';
import { SolarCoverageChart } from './SolarCoverageChart';
import { ExportRatioChart } from './ExportRatioChart';
import { StaleTariffBanner } from '@/src/components/StaleTariffBanner';
import type { StaleTariffWarning } from '@/src/tariffs/stale-check';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type RangeHistoryScreenProps = {
  payload: RangeSummaryPayload | null;
  today: string;
  financeContext: RangeFinanceContext | null;
  initialMode: string | null;
  initialFrom: string | null;
  initialTo: string | null;
  error: boolean;
  staleTariffWarning: StaleTariffWarning;
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

export function RangeHistoryScreen({ payload, today, financeContext, initialMode, initialFrom, initialTo, error, staleTariffWarning }: RangeHistoryScreenProps) {
  const router = useRouter();

  const earliestDate = payload?.meta.earliestDate ?? null;
  const loadedFrom = payload?.meta.from ?? loadedWindowStart(today);

  const [activeRange, setActiveRange] = useState<ActiveRange>(() => {
    if (initialMode === 'all') {
      const from = earliestDate ?? loadedWindowStart(today);
      return { mode: 'all', from, to: today };
    }
    if (initialFrom && initialTo) {
      const VALID_MODES: RangeMode[] = ['custom', 'weeks', 'months', 'years'];
      const mode: RangeMode = VALID_MODES.includes(initialMode as RangeMode)
        ? (initialMode as RangeMode)
        : 'custom';
      return { mode, from: initialFrom, to: initialTo };
    }
    return defaultActiveRange(today);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    window.history.replaceState(null, '', buildRangeUrl(activeRange));
  }, [activeRange]);

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

  // ---------------------------------------------------------------------------
  // Navigation handler — handles picker selections from this screen
  // ---------------------------------------------------------------------------
  function handleNavigate(target: NavigationTarget) {
    if (target.type === 'range') {
      const range = target.range;
      if (range.mode === 'all' && earliestDate && earliestDate < loadedFrom) {
        router.push('/range?mode=all');
        return;
      }
      // Selected range predates loaded window and there is known data in that period — reload.
      if (range.from < loadedFrom && earliestDate != null && earliestDate <= range.to) {
        router.push(buildRangeUrl(range));
        return;
      }
      setActiveRange(range);
      // Leave picker open — user can refine further; closes on outside click / Esc
    } else if (target.type === 'live') {
      router.push('/live');
    } else {
      router.push(`/history/${target.date}`);
    }
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
    if (next.from < loadedFrom && earliestDate != null && earliestDate < loadedFrom) {
      router.push(buildRangeUrl(next));
      return;
    }
    setActiveRange(next);
  }

  const health = payload?.health;
  const hasTariffChange = useMemo(() => {
    const ids = new Set(filteredSeries.map((d) => d.tariffVersionId).filter(Boolean));
    return ids.size > 1;
  }, [filteredSeries]);

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
              <BarChart3 size={14} className="text-indigo-400" />
              <span className="text-sm font-semibold text-slate-100">Range History</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              title="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
            >
              <Settings size={14} />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
              J
            </div>
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
                onNavigate={handleNavigate}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>


        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <StaleTariffBanner warning={staleTariffWarning} />

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
                {/* §2a — Combined warnings callout */}
                {(kpis.missingDays > 0 || kpis.partialDays > 0 || hasTariffChange) && !warningsDismissed && (
                  <WarningsCallout
                    missingDays={kpis.missingDays}
                    partialDays={kpis.partialDays}
                    coveredDays={kpis.coveredDays}
                    hasTariffChange={hasTariffChange}
                    series={filteredSeries}
                    onDismiss={() => setWarningsDismissed(true)}
                  />
                )}

                {/* §2 — Financial summary */}
                <FinancialSummaryPanel
                  kpis={kpis}
                  currency={payload?.meta.currency ?? 'EUR'}
                />

                {/* §4–§9 Charts */}
                <ChartPlaceholders
                  hasTariff={kpis.hasTariff}
                  series={filteredSeries}
                  currency={payload?.meta.currency ?? 'EUR'}
                />

                {/* §10 — Investment insights (recovery, repayment coverage, payoff outlook) */}
                <InvestmentInsightsPanel
                  financeContext={financeContext}
                  periodTotalSolarValue={kpis.totalSolarValue}
                  periodFrom={effectiveRange.from}
                  periodTo={effectiveRange.to}
                  rangeMode={effectiveRange.mode}
                  hasTariff={kpis.hasTariff}
                  earliestSummaryDate={payload?.meta.earliestDate ?? null}
                  latestSummaryDate={lastCoveredDate}
                  today={today}
                  currency={payload?.meta.currency ?? 'EUR'}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §2 — Financial summary panel
// ---------------------------------------------------------------------------

type FinancialSummaryPanelProps = {
  kpis: ReturnType<typeof aggregateKpisFromSeries>;
  currency: string;
};

function FinancialSummaryPanel({ kpis, currency }: FinancialSummaryPanelProps) {
  if (!kpis.hasTariff) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-700 bg-[#111b2b] p-6 text-center">
        <p className="mb-1 text-sm font-semibold text-slate-300">Add a tariff to see cost and savings</p>
        <p className="mb-4 text-xs text-slate-400">
          Energy charts are still available below. Financial data requires a tariff to be configured.
        </p>
        <Link
          href="/settings/tariffs"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          Set up tariff →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {kpis.tariffGapDays > 0 && (
        <p className="text-xs text-slate-400">
          Financial data covers {kpis.coveredDays - kpis.tariffGapDays} of {kpis.coveredDays} days.{' '}
          <Link href="/settings/tariffs" className="text-indigo-400 hover:underline">
            Add tariff history to extend coverage.
          </Link>
        </p>
      )}
      <SolarImpactPanel kpis={kpis} currency={currency} />
    </div>
  );
}

function SolarImpactPanel({ kpis, currency }: { kpis: ReturnType<typeof aggregateKpisFromSeries>; currency: string }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">Solar impact estimate</p>
      </div>

      {/* Solar value metrics */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <BillMetric
          label="Solar value"
          value={formatCurrency(kpis.totalSolarValue, currency)}
          note="Total created this period"
        />
        <BillMetric
          label="Self-consumed"
          value={formatCurrency(kpis.selfConsumedSolarValue, currency)}
          note="Avoided import cost"
        />
        <BillMetric
          label="Export credit"
          value={formatCurrency(kpis.actualExportCredit, currency)}
          note="Earned from grid export"
        />
        {kpis.avgSelfConsumptionRatio != null ? (
          <BillMetric
            label="Solar coverage"
            value={formatPercent(kpis.avgSelfConsumptionRatio)}
            note="Of own consumption"
          />
        ) : (
          <div />
        )}
      </div>

      {/* Bill impact metrics */}
      <div className="mt-5 border-t border-slate-800/60 pt-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <BillMetric
            label="Import bill"
            value={formatCurrency(kpis.importBill, currency)}
            note="Tariff-priced actual"
          />
          <BillMetric
            label="Net energy bill"
            value={formatCurrency(kpis.netEnergyBill, currency)}
            note="After export credit"
          />
          <BillMetric
            label="Bill without solar"
            value={formatCurrency(kpis.withoutSolarNetCost, currency)}
            note="Estimated counterfactual"
            estimated
          />
          <BillMetric
            label="Bill reduction"
            value={formatCurrency(kpis.billReductionFromSolar, currency)}
            note="Estimated saving on bill"
            estimated
            positive
          />
        </div>
      </div>
    </div>
  );
}

function BillMetric({
  label,
  value,
  note,
  estimated = false,
  positive = false,
}: {
  label: string;
  value: string;
  note: string;
  estimated?: boolean;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
        {estimated && <span className="ml-1 normal-case tracking-normal text-slate-500">est.</span>}
      </p>
      <p className={[
        'mt-1.5 font-mono text-base font-semibold',
        positive ? 'text-emerald-400' : 'text-slate-200',
      ].join(' ')}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §2a — Combined warnings callout
// ---------------------------------------------------------------------------

function WarningsCallout({
  missingDays,
  partialDays,
  coveredDays,
  hasTariffChange,
  series,
  onDismiss,
}: {
  missingDays: number;
  partialDays: number;
  coveredDays: number;
  hasTariffChange: boolean;
  series: RangeSeriesDay[];
  onDismiss: () => void;
}) {
  const totalDays = coveredDays + missingDays;
  const coveragePct = totalDays > 0 ? Math.round((coveredDays / totalDays) * 100) : 100;
  const tariffVersionCount = new Set(series.map((d) => d.tariffVersionId).filter(Boolean)).size;

  const completenessParts: string[] = [];
  if (missingDays > 0)
    completenessParts.push(`${missingDays} day${missingDays !== 1 ? 's are' : ' is'} missing from this period`);
  if (partialDays > 0)
    completenessParts.push(`${partialDays} day${partialDays !== 1 ? 's' : ''} recorded < 90% expected data`);

  const hasCompleteness = completenessParts.length > 0;

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="flex-1 space-y-1.5">
          {hasCompleteness && (
            <p className="text-sm text-amber-300/90">
              <span className="font-semibold text-amber-200">{completenessParts.join(', ')}</span>
              {' — '}
              Totals calculated from {coveragePct}% of possible recoverable data.
            </p>
          )}
          {hasTariffChange && (
            <p className="text-sm text-amber-300/90">
              <span className="font-semibold text-amber-200">Tariff changed during this period</span>
              {' — '}
              {tariffVersionCount} tariff version{tariffVersionCount !== 1 ? 's' : ''} applied.
              Financial totals reflect each day's applicable rate.
            </p>
          )}
        </div>
        <button onClick={onDismiss} className="shrink-0 text-amber-500/50 hover:text-amber-400">
          <X size={13} />
        </button>
      </div>
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
  currency,
}: {
  hasTariff: boolean;
  series: RangeSeriesDay[];
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
    let freeImportKwh = 0;
    let totalImportKwh = 0;
    for (const d of series) {
      if (!d.hasSummary) continue;
      totalImportKwh += d.importKwh;
      if (!d.billing) continue;
      importCost += d.billing.importCost;
      fixedCharges += d.billing.fixedCharges;
      exportCredit += d.billing.exportCredit;
      savings += d.billing.savings;
      freeImportKwh += d.billing.freeImportKwh;
    }
    // Value free import at the average rate paid for metered (non-free) imports.
    const paidImportKwh = totalImportKwh - freeImportKwh;
    const avgPaidRate = paidImportKwh > 0 ? importCost / paidImportKwh : 0;
    const freeImportValue = Math.round(freeImportKwh * avgPaidRate * 100) / 100;
    return {
      importCost: Math.round(importCost * 100) / 100,
      fixedCharges: Math.round(fixedCharges * 100) / 100,
      exportCredit: Math.round(exportCredit * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      freeImportKwh: Math.round(freeImportKwh * 100) / 100,
      freeImportValue,
      avgPaidRate: Math.round(avgPaidRate * 10000) / 10000,
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
          <ChartCard title="Net daily cost vs without solar" icon={<BarChart3 size={14} />} onReset={resetCharts}>
            <CostHistogramChart key={resetKey} series={series} currency={currency} />
          </ChartCard>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ChartCard title="Period cost breakdown" icon={<Zap size={14} />}>
              <PeriodCostDonutChart
                totals={periodCostTotals}
                simplified={false}
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
        href="/settings/tariffs"
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
        <span className="text-slate-500">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</span>
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
// §10 — Investment insights panel
// ---------------------------------------------------------------------------

function InvestmentInsightsPanel({
  financeContext,
  periodTotalSolarValue,
  periodFrom,
  periodTo,
  rangeMode,
  hasTariff,
  earliestSummaryDate,
  latestSummaryDate,
  today,
  currency,
}: {
  financeContext: RangeFinanceContext | null;
  periodTotalSolarValue: number;
  periodFrom: string;
  periodTo: string;
  rangeMode: RangeMode;
  hasTariff: boolean;
  earliestSummaryDate: string | null;
  latestSummaryDate: string | null;
  today: string;
  currency: string;
}) {
  if (!financeContext) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-700 bg-[#111b2b] p-5 text-center">
        <TrendingUp size={20} className="mx-auto mb-3 text-slate-700" />
        <p className="mb-1 text-sm font-semibold text-slate-400">Track your investment recovery</p>
        <p className="mb-4 text-xs text-slate-500">
          Add your system investment details to see how your solar savings are recovering your costs.
        </p>
        <Link
          href="/settings/finance"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          Set up investment →
        </Link>
      </div>
    );
  }

  const { totalSystemInvestment, earliestAdditionDate, allTimeSavings, allTimeCoveredDays, repaymentSchedules } = financeContext;
  const payoffOutlook = computePayoffOutlook(financeContext, latestSummaryDate ?? today);
  const calendarAligned = rangeMode === 'months' || rangeMode === 'years';
  const { amount: repaymentsInPeriod, isProRata: repaymentsIsProRata } = computeRepaymentsForPeriod(repaymentSchedules, periodFrom, periodTo, calendarAligned);

  const recoveryPct = totalSystemInvestment > 0
    ? Math.min(100, Math.round((allTimeSavings / totalSystemInvestment) * 100))
    : 0;
  const hasPartialHistory =
    earliestSummaryDate != null && earliestAdditionDate < earliestSummaryDate;
  const noHistoryYet = allTimeCoveredDays === 0;

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-3 sm:p-5 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-slate-500" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Investment recovery</span>
      </div>

      {/* Recovered so far */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-400">Recovered so far</span>
          <span className="text-xs font-semibold tabular-nums text-emerald-400">
            {formatCurrency(allTimeSavings, currency)}{' '}
            <span className="font-normal text-slate-400">of {formatCurrency(totalSystemInvestment, currency)}</span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${recoveryPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {noHistoryYet ? (
            <p className="text-[11px] text-slate-400">
              No billing history yet — add a tariff to start tracking your recovery
            </p>
          ) : hasPartialHistory ? (
            <p className="text-[11px] text-slate-400">
              Based on {allTimeCoveredDays} day{allTimeCoveredDays !== 1 ? 's' : ''} of recorded history.
              History begins after your addition date — earlier savings are not included.
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">
              From {allTimeCoveredDays} day{allTimeCoveredDays !== 1 ? 's' : ''} of recorded history
            </p>
          )}
          <span className="shrink-0 pl-4 text-[11px] font-semibold tabular-nums text-slate-400">{recoveryPct}%</span>
        </div>
      </div>

      {/* Period net solar position — shown whenever tariff-backed period value is available */}
      {hasTariff && (
        <PeriodRepaymentCoverage
          periodTotalSolarValue={periodTotalSolarValue}
          periodPayments={repaymentsInPeriod}
          rangeMode={rangeMode}
          currency={currency}
        />
      )}

      {/* Approximate payoff outlook */}
      {payoffOutlook && (
        <PayoffOutlookRow outlook={payoffOutlook} currency={currency} />
      )}
    </div>
  );
}

function PeriodRepaymentCoverage({
  periodTotalSolarValue,
  periodPayments,
  rangeMode,
  currency,
}: {
  periodTotalSolarValue: number;
  periodPayments: number;
  rangeMode: RangeMode;
  currency: string;
}) {
  const repaymentLabel =
    rangeMode === 'months' ? 'monthly repayment' :
    rangeMode === 'years'  ? 'yearly repayment'  :
                             'pro-rata repayment for period';

  const isPositive = periodTotalSolarValue >= periodPayments;
  const coveragePct = periodPayments > 0
    ? Math.round((periodTotalSolarValue / periodPayments) * 100)
    : null;
  const netSolarPosition = Math.round((periodTotalSolarValue - periodPayments) * 100) / 100;

  // For the positive over-100% case: grey fills to the repayment point, green fills the surplus.
  // repaymentBarFrac = what fraction of the bar width represents "exactly 100% covered".
  const hasGreenSurplus = coveragePct != null && coveragePct > 100;
  const repaymentBarFrac = hasGreenSurplus ? (100 / coveragePct!) * 100 : null;
  // Width of the grey portion of the bar.
  const greyBarPct = repaymentBarFrac ?? Math.min(100, coveragePct ?? 0);

  return (
    <div className="border-t border-slate-800/80 pt-4">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-400">Net solar position this period</span>
        {/* Repayments label stays in the header only for the negative/zero case */}
        {!hasGreenSurplus && periodPayments > 0 && (
          <span className="text-[11px] text-slate-400">
            {formatCurrency(periodPayments, currency)} {repaymentLabel}
          </span>
        )}
      </div>

      {/* Label row — sits directly above the bar */}
      <div className="relative h-5">
        {/* Negative: solar-value label at the bar's right edge */}
        {!isPositive && coveragePct != null && greyBarPct > 3 && (
          <span
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-300"
            style={{ left: `${greyBarPct}%` }}
          >
            {formatCurrency(periodTotalSolarValue, currency)}
          </span>
        )}
        {/* Positive surplus: repayments label at the grey/green boundary */}
        {repaymentBarFrac != null && (
          <span
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-400"
            style={{ left: `${repaymentBarFrac}%` }}
          >
            {formatCurrency(periodPayments, currency)} {repaymentLabel}
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="mb-3 h-2.5 rounded-full bg-slate-800 relative overflow-hidden">
        {/* Grey portion — always present */}
        <div
          className="absolute left-0 top-0 h-full bg-slate-500 transition-all duration-500"
          style={{ width: `${greyBarPct}%` }}
        />
        {/* Green surplus — positive over-100% case only */}
        {repaymentBarFrac != null && (
          <div
            className="absolute top-0 h-full bg-emerald-500 transition-all duration-500"
            style={{ left: `${repaymentBarFrac}%`, right: 0 }}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-slate-400">
          Solar created{' '}
          <span className={isPositive ? 'font-medium text-emerald-400' : 'font-medium text-slate-300'}>
            {formatCurrency(periodTotalSolarValue, currency)}
          </span>
          .{' '}
          <span className="font-medium text-slate-300">
            {formatCurrency(periodPayments, currency)}
          </span>
          {' '}{repaymentLabel}. Net position{' '}
          <span className={isPositive ? 'font-medium text-emerald-400' : 'font-medium text-rose-400'}>
            {isPositive ? '+' : ''}{formatCurrency(netSolarPosition, currency)}
          </span>
        </p>
        <span
          className={[
            'shrink-0 pl-4 text-[11px] font-semibold tabular-nums',
            isPositive ? 'text-emerald-400' : 'text-slate-400',
          ].join(' ')}
        >
          {coveragePct != null ? `${coveragePct}%` : '—'}
        </span>
      </div>
    </div>
  );
}

function PayoffOutlookRow({
  outlook,
  currency,
}: {
  outlook: NonNullable<ReturnType<typeof computePayoffOutlook>>;
  currency: string;
}) {
  if (outlook.status === 'recovered') {
    const recoveredDate = formatDate(outlook.estimatedRecoveredDate);
    return (
      <div className="border-t border-slate-800/80 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-400">Approximate payoff outlook</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Investment was fully recovered around {recoveredDate} based on{' '}
              {outlook.observedDays.toLocaleString()} day{outlook.observedDays !== 1 ? 's' : ''} of recorded data.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-emerald-400">Recovered</p>
            <p className="text-[11px] text-slate-400">
              {formatCurrency(outlook.avgDailySavings, currency)}/day avg
            </p>
          </div>
        </div>
      </div>
    );
  }

  const payoffDate = formatDate(outlook.estimatedPayoffDate);
  return (
    <div className="border-t border-slate-800/80 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">Approximate payoff outlook</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Based on {formatCurrency(outlook.avgDailySavings, currency)}/day average savings across{' '}
            {outlook.observedDays.toLocaleString()} recorded day{outlook.observedDays !== 1 ? 's' : ''} —
            guidance only, will change as more data arrives
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-200">~{payoffDate}</p>
          <p className="text-[11px] text-slate-400">{outlook.estimatedDaysRemaining.toLocaleString()} days</p>
        </div>
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
