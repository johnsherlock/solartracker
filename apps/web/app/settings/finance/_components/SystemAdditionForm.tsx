'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Trash2 } from 'lucide-react';
import DateField from '@/src/components/DateField';
import type { SystemAdditionRecord } from '@/src/finance/system-addition-types';
import {
  createSystemAddition,
  updateSystemAddition,
  deleteSystemAddition,
} from '../actions';

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
// Shared field primitives
// ---------------------------------------------------------------------------

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
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
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SystemAdditionFormProps =
  | { mode: 'create' }
  | { mode: 'edit'; record: SystemAdditionRecord };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SystemAdditionForm(props: SystemAdditionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const existing = props.mode === 'edit' ? props.record : null;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [additionDate, setAdditionDate] = useState(existing?.additionDate ?? '');
  const [capacityAddedKw, setCapacityAddedKw] = useState(
    existing?.capacityAddedKw != null ? String(existing.capacityAddedKw) : '',
  );
  const [upfrontPayment, setUpfrontPayment] = useState(
    existing?.upfrontPayment != null ? String(existing.upfrontPayment) : '',
  );
  const [monthlyRepayment, setMonthlyRepayment] = useState(
    existing?.monthlyRepayment != null ? String(existing.monthlyRepayment) : '',
  );
  const [repaymentDurationMonths, setRepaymentDurationMonths] = useState(
    existing?.repaymentDurationMonths != null ? String(existing.repaymentDurationMonths) : '',
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedTotal = previewTotal(upfrontPayment, monthlyRepayment, repaymentDurationMonths);
  const busy = saving || deleting || isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input = {
      label,
      additionDate,
      capacityAddedKw,
      upfrontPayment,
      monthlyRepayment,
      repaymentDurationMonths,
    };

    const result =
      props.mode === 'create'
        ? await createSystemAddition(input)
        : await updateSystemAddition(props.record.id, input);

    setSaving(false);
    if (result.ok) {
      startTransition(() => router.push('/settings/finance'));
    } else {
      setError(result.error);
    }
  }

  async function handleDelete() {
    if (props.mode !== 'edit') return;
    setDeleting(true);
    setError(null);
    const result = await deleteSystemAddition(props.record.id);
    setDeleting(false);
    if (result.ok) {
      startTransition(() => router.push('/settings/finance'));
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Label */}
      <div>
        <FieldLabel htmlFor="label" required>
          Label
        </FieldLabel>
        <TextInput
          id="label"
          type="text"
          placeholder="e.g. Original install, Rear-roof expansion"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          A short name for this addition — it will appear in your system history.
        </p>
      </div>

      {/* Date */}
      <div>
        <FieldLabel htmlFor="additionDate" required>
          Date
        </FieldLabel>
        <div className="w-56">
          <DateField
            value={additionDate}
            onChange={setAdditionDate}
            placeholder="Select date"
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          The date this addition was installed or paid for.
        </p>
      </div>

      {/* Capacity kWp */}
      <div>
        <FieldLabel htmlFor="capacityAddedKw">
          Capacity added (kWp)
        </FieldLabel>
        <TextInput
          id="capacityAddedKw"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 3.20"
          value={capacityAddedKw}
          onChange={(e) => setCapacityAddedKw(e.target.value)}
          className="w-32"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Peak output capacity of the panels added. Leave blank if not relevant.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800/60 pt-2">
        <p className="text-xs font-medium text-slate-400 mb-4">Payment details</p>

        {/* Upfront payment */}
        <div className="flex flex-col gap-6">
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
              Cash paid upfront. Leave blank if fully financed.
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
              Monthly finance payment including interest.
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
        </div>
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
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? 'Saving…' : props.mode === 'create' ? 'Save addition' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/finance')}
            disabled={busy}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {props.mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            {deleting ? 'Deleting…' : 'Delete this addition'}
          </button>
        )}
      </div>
    </form>
  );
}
