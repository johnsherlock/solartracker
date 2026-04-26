import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TrendingUp, Plus, CheckCircle2, ArrowRight } from 'lucide-react';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { loadSystemAdditionsSettings } from '@/src/finance/loader';
import type { SystemAdditionRecord } from '@/src/finance/system-addition-types';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

// ---------------------------------------------------------------------------
// Record card
// ---------------------------------------------------------------------------

function SystemAdditionCard({ record }: { record: SystemAdditionRecord }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Date', value: formatDate(record.additionDate) },
  ];

  if (record.capacityAddedKw != null) {
    rows.push({ label: 'Capacity added', value: `${record.capacityAddedKw} kWp` });
  }

  if (record.upfrontPayment != null) {
    rows.push({ label: 'Upfront payment', value: formatCurrency(record.upfrontPayment) });
  }

  if (record.monthlyRepayment != null && record.repaymentDurationMonths != null) {
    rows.push({
      label: 'Monthly repayment',
      value: `${formatCurrency(record.monthlyRepayment)} × ${record.repaymentDurationMonths} months`,
    });
  }

  rows.push({ label: 'Total investment', value: formatCurrency(record.totalInvestment) });

  if (record.remainingMonths != null) {
    rows.push({
      label: 'Remaining repayment',
      value:
        record.remainingMonths === 0
          ? 'Fully repaid'
          : `${record.remainingMonths} month${record.remainingMonths !== 1 ? 's' : ''}`,
    });
  }

  if (record.outstandingBalance != null && record.remainingMonths !== 0) {
    rows.push({
      label: 'Outstanding balance',
      value: formatCurrency(record.outstandingBalance),
    });
  }

  return (
    <div className="rounded-[20px] border border-slate-800 bg-[#111b2b] p-5 shadow-[0_8px_30px_rgba(2,6,23,0.25)]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-px" />
          <span className="text-sm font-semibold text-slate-100">{record.label}</span>
        </div>
        <Link
          href={`/settings/finance/${record.id}/edit`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Edit <ArrowRight size={10} />
        </Link>
      </div>

      <dl className="flex flex-col gap-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-slate-100 tabular-nums text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
      <TrendingUp size={28} className="mx-auto mb-4 text-slate-600" />
      <p className="text-sm font-semibold text-slate-300">No system additions yet</p>
      <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
        Add your first system addition — typically the original install — to unlock the payback
        progress tracker.
      </p>
      <Link
        href="/settings/finance/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
      >
        <Plus size={12} />
        Add system addition
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FinancePage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const payload = await loadSystemAdditionsSettings(installationId);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-100">Finance</h1>
        </div>
        {payload.configured && (
          <Link
            href="/settings/finance/new"
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-600/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus size={11} />
            Add addition
          </Link>
        )}
      </div>

      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-prose">
        Record each step in your system's history — the original install and any later expansions.
        Each addition captures the physical change and how it was paid for, unlocking the payback
        progress tracker.
      </p>

      {!payload.configured ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {payload.records.map((record) => (
            <SystemAdditionCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
