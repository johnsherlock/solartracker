'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveFinanceSettings } from './actions';
import type { FinanceSettingsPayload } from '@/src/finance/finance-types';
import DateField from '@/src/components/DateField';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoDate + 'T00:00:00'));
}

// ---------------------------------------------------------------------------
// Derive preview total from raw string inputs (mirrors finance-domain logic)
// ---------------------------------------------------------------------------

function previewTotal(
  upfrontStr: string,
  monthlyStr: string,
  durationStr: string,
): number | null {
  const upfront = upfrontStr !== '' ? parseFloat(upfrontStr) : null;
  const monthly = monthlyStr !== '' ? parseFloat(monthlyStr) : null;
  const duration = durationStr !== '' ? parseInt(durationStr, 10) : null;
  if (upfront == null && monthly == null) return null;
  const upfrontTotal = upfront ?? 0;
  const repaymentTotal = monthly != null && duration != null ? monthly * duration : 0;
  return upfrontTotal + repaymentTotal;
}

// ---------------------------------------------------------------------------
// Summary view
// ---------------------------------------------------------------------------

function FinanceSummary({
  payload,
  onEdit,
}: {
  payload: Extract<FinanceSettingsPayload, { configured: true }>;
  onEdit: () => void;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Investment date', value: formatDate(payload.investmentDate) },
  ];

  if (payload.upfrontPayment != null) {
    rows.push({ label: 'Upfront payment', value: formatCurrency(payload.upfrontPayment) });
  }

  if (payload.monthlyRepayment != null && payload.repaymentDurationMonths != null) {
    rows.push({
      label: 'Monthly repayment',
      value: `${formatCurrency(payload.monthlyRepayment)} × ${payload.repaymentDurationMonths} months`,
    });
  }

  rows.push({ label: 'Total investment', value: formatCurrency(payload.totalInvestment) });

  if (payload.remainingMonths != null) {
    rows.push({
      label: 'Remaining repayment months',
      value: payload.remainingMonths === 0 ? 'Fully repaid' : `${payload.remainingMonths} months`,
    });
  }

  if (payload.outstandingBalance != null) {
    rows.push({
      label: 'Outstanding scheduled balance',
      value: payload.remainingMonths === 0 ? '—' : formatCurrency(payload.outstandingBalance),
    });
  }

  return (
    <div className="rounded-[20px] border border-emerald-800/30 bg-[#0d1f18] p-5 shadow-[0_8px_30px_rgba(2,6,23,0.25)]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Finance configured
          </span>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          <Pencil size={10} />
          Edit
        </button>
      </div>

      <dl className="flex flex-col gap-2.5">
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
// Form field helpers
// ---------------------------------------------------------------------------

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-300 mb-1.5">
      {children}
      {required && <span className="text-slate-500 ml-1">*</span>}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600',
        'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500',
        'transition-colors',
        // Remove number input spinners
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------

function FinanceEditForm({
  initial,
  onCancel,
}: {
  initial: FinanceSettingsPayload;
  onCancel: (() => void) | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const configured = initial.configured ? initial : null;

  const [investmentDate, setInvestmentDate] = useState(configured?.investmentDate ?? '');
  const [upfrontPayment, setUpfrontPayment] = useState(
    configured?.upfrontPayment != null ? String(configured.upfrontPayment) : '',
  );
  const [monthlyRepayment, setMonthlyRepayment] = useState(
    configured?.monthlyRepayment != null ? String(configured.monthlyRepayment) : '',
  );
  const [repaymentDurationMonths, setRepaymentDurationMonths] = useState(
    configured?.repaymentDurationMonths != null
      ? String(configured.repaymentDurationMonths)
      : '',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedTotal = previewTotal(upfrontPayment, monthlyRepayment, repaymentDurationMonths);
  const busy = saving || isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await saveFinanceSettings({
      investmentDate,
      upfrontPayment,
      monthlyRepayment,
      repaymentDurationMonths,
    });

    setSaving(false);
    if (result.ok) {
      startTransition(() => router.refresh());
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Investment date */}
      <div>
        <FieldLabel htmlFor="investmentDate" required>
          Approximate investment date
        </FieldLabel>
        <div className="w-56">
          <DateField
            value={investmentDate}
            onChange={setInvestmentDate}
            placeholder="Select investment date"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          The approximate date your solar installation was paid for or financed.
        </p>
      </div>

      {/* Upfront payment */}
      <div>
        <FieldLabel htmlFor="upfrontPayment">
          Upfront payment (€)
        </FieldLabel>
        <TextInput
          id="upfrontPayment"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={upfrontPayment}
          onChange={(e) => setUpfrontPayment(e.target.value)}
          className="w-40"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Cash paid upfront at the time of installation. Leave blank if fully financed.
        </p>
      </div>

      {/* Monthly repayment */}
      <div>
        <FieldLabel htmlFor="monthlyRepayment">
          Monthly repayment (€)
        </FieldLabel>
        <TextInput
          id="monthlyRepayment"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={monthlyRepayment}
          onChange={(e) => setMonthlyRepayment(e.target.value)}
          className="w-40"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Monthly finance payment including interest. Required if repayment duration is set.
        </p>
      </div>

      {/* Repayment duration */}
      <div>
        <FieldLabel htmlFor="repaymentDurationMonths">
          Repayment duration (months)
        </FieldLabel>
        <TextInput
          id="repaymentDurationMonths"
          type="number"
          min="1"
          step="1"
          placeholder="e.g. 60"
          value={repaymentDurationMonths}
          onChange={(e) => setRepaymentDurationMonths(e.target.value)}
          className="w-28"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Total number of monthly repayments. Required when monthly repayment is set.
        </p>
      </div>

      {/* Derived total preview */}
      {derivedTotal != null && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400">Estimated total investment</span>
          <span className="text-sm font-semibold text-slate-100 tabular-nums">
            {formatCurrency(derivedTotal)}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          {busy ? 'Saving…' : 'Save finance details'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export default function FinanceForm({ initialPayload }: { initialPayload: FinanceSettingsPayload }) {
  const [editing, setEditing] = useState(!initialPayload.configured);

  // When router.refresh() delivers updated server props, exit edit mode.
  useEffect(() => {
    if (initialPayload.configured) setEditing(false);
  }, [initialPayload]);

  if (!editing && initialPayload.configured) {
    return (
      <FinanceSummary
        payload={initialPayload}
        onEdit={() => setEditing(true)}
      />
    );
  }

  return (
    <FinanceEditForm
      initial={initialPayload}
      onCancel={initialPayload.configured ? () => setEditing(false) : null}
    />
  );
}
