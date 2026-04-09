'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  Home,
  Info,
  RefreshCw,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { RangeSummaryPayload, RangeSeriesDay } from '@/src/range/types';
import {
  type RangePreset,
  type PresetWindow,
  PRESET_LABELS,
  PRESET_ORDER,
  DEFAULT_PRESET,
  computePresetWindow,
  clampToLoadedWindow,
  formatCustomWindowLabel,
  loadedWindowStart,
} from '@/src/range/presets';
import {
  aggregateKpisFromSeries,
  formatCurrency,
  formatPercent,
} from '@/src/range/kpi';
import { EnergyTrendChart } from './EnergyTrendChart';
import { PerDayBarChart } from './PerDayBarChart';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type RangeHistoryScreenProps = {
  payload: RangeSummaryPayload | null;
  today: string;
  financeMode: string | null;
  error: boolean;
};

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

export function RangeHistoryScreen({ payload, today, financeMode, error }: RangeHistoryScreenProps) {
  const [activePreset, setActivePreset] = useState<RangePreset | 'custom'>(DEFAULT_PRESET);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [tariffCalloutDismissed, setTariffCalloutDismissed] = useState(false);

  const windowStart = loadedWindowStart(today);

  const activeWindow: PresetWindow = useMemo(() => {
    if (activePreset === 'custom' && customFrom && customTo) {
      return clampToLoadedWindow(customFrom, customTo, today);
    }
    return computePresetWindow(activePreset as RangePreset, today);
  }, [activePreset, customFrom, customTo, today]);

  const filteredSeries = useMemo(() => {
    if (!payload) return [];
    return payload.series.filter(
      (d) => d.date >= activeWindow.from && d.date <= activeWindow.to,
    );
  }, [payload, activeWindow]);

  const kpis = useMemo(() => {
    if (!payload) return null;
    return aggregateKpisFromSeries(filteredSeries, activeWindow.from, activeWindow.to);
  }, [payload, filteredSeries, activeWindow]);

  const isFinanced = financeMode === 'finance';

  function handlePresetClick(preset: RangePreset) {
    setActivePreset(preset);
    setCustomOpen(false);
  }

  function handleCustomApply() {
    if (customFrom && customTo && customFrom <= customTo) {
      setActivePreset('custom');
      setCustomOpen(false);
    }
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

  const customWindowLabel =
    activePreset === 'custom' && customFrom && customTo
      ? formatCustomWindowLabel(customFrom, customTo)
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
          {/* Preset pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={[
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activePreset === preset
                    ? 'border-indigo-500/60 bg-indigo-600 text-white'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
                ].join(' ')}
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
            <button
              onClick={() => setCustomOpen((v) => !v)}
              className={[
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activePreset === 'custom'
                  ? 'border-indigo-500/60 bg-indigo-600 text-white'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100',
              ].join(' ')}
            >
              {customWindowLabel ?? 'Custom…'}
            </button>
          </div>

          {/* Custom range disclosure */}
          {customOpen && (
            <div className="mt-2 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-700 bg-[#111b2b] p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">From</label>
                <input
                  type="date"
                  value={customFrom}
                  min={windowStart}
                  max={customTo || today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || windowStart}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo || customFrom > customTo}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-indigo-500"
              >
                Apply
              </button>
              <button
                onClick={() => setCustomOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Trust strip */}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
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
              <EmptyCard from={activeWindow.from} to={activeWindow.to} />
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

                {/* §4–§9 Chart placeholder cards */}
                <ChartPlaceholders hasTariff={kpis.hasTariff} series={filteredSeries} />

                {/* §10 — Payback placeholder (financed only) */}
                {isFinanced && <PaybackPlaceholder />}
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

function ChartPlaceholders({ hasTariff, series }: { hasTariff: boolean; series: RangeSeriesDay[] }) {
  return (
    <>
      <ChartCard section="§4" title="Energy trend" icon={<TrendingUp size={14} />}>
        <EnergyTrendChart series={series} />
      </ChartCard>
      <ChartCard section="§5" title="Per-day breakdown" icon={<BarChart3 size={14} />}>
        <PerDayBarChart series={series} />
      </ChartCard>
      {hasTariff ? (
        <>
          <ChartCard section="§6" title="Daily cost vs without solar" icon={<BarChart3 size={14} />} />
          <ChartCard section="§7" title="Period cost breakdown" icon={<Zap size={14} />} />
        </>
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-800 bg-[#111b2b] px-5 py-6 text-center text-xs text-slate-600">
          Financial charts (§6, §7) require a tariff.{' '}
          <Link href="/tariffs" className="text-indigo-400 hover:underline">Set up tariff →</Link>
        </div>
      )}
      <ChartCard section="§8" title="Solar coverage" icon={<Zap size={14} />} />
      <ChartCard section="§9" title="Export ratio" icon={<TrendingUp size={14} />} />
    </>
  );
}

function ChartCard({
  section,
  title,
  icon,
  children,
}: {
  section: string;
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-slate-600">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</span>
        <span className="ml-auto text-[10px] text-slate-800">{section}</span>
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
// §10 — Payback placeholder (financed installations only)
// ---------------------------------------------------------------------------

function PaybackPlaceholder() {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-slate-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payback progress</span>
        <span className="ml-auto text-[10px] text-slate-800">§10</span>
      </div>
      <div className="flex h-16 items-center justify-center rounded-2xl border border-dashed border-slate-800/80 text-[11px] text-slate-700">
        Payback tracker coming in U-044
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
