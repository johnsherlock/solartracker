'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveSystemCapacity } from './actions';

export default function SystemCapacityForm({
  currentCapacityKw,
}: {
  currentCapacityKw: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [capacityKw, setCapacityKw] = useState(currentCapacityKw);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const busy = saving || isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await saveSystemCapacity(capacityKw);
    setSaving(false);

    if (result.ok) {
      setSaved(true);
      startTransition(() => router.refresh());
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

      {saved && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-4 py-3">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-sm text-emerald-300">System capacity saved.</p>
        </div>
      )}

      <div>
        <label
          htmlFor="capacityKw"
          className="block text-xs font-medium text-slate-300 mb-1.5"
        >
          Total array capacity (kWp)
        </label>
        <input
          id="capacityKw"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="e.g. 6.40"
          value={capacityKw}
          onChange={(e) => {
            setCapacityKw(e.target.value);
            setSaved(false);
          }}
          className={[
            'rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600',
            'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500',
            'transition-colors w-36',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          ].join(' ')}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          The combined peak-power rating of all your panels in kilowatts-peak. Leave blank if
          unknown — yield context will not be shown until this is set.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/settings')}
          disabled={busy}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
