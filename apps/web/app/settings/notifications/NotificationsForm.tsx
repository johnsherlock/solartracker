'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveNotificationPreferences } from './actions';
import type { NotificationPreferences } from './actions';

type Props = {
  initial: NotificationPreferences;
  isSaved: boolean;
};

const CATEGORIES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  deliveryNote?: string;
}[] = [
  {
    key: 'tariffReminder',
    label: 'Tariff end-date reminder',
    description: 'Alert when your tariff validity is within 7 days of ending.',
    deliveryNote: 'In-app',
  },
  {
    key: 'missingData',
    label: 'Missing data alert',
    description: 'Alert when daily data coverage falls below 90%.',
    deliveryNote: 'Preference capture only — delivery coming soon',
  },
  {
    key: 'generationAlerts',
    label: 'Generation highlights',
    description: 'Highlight when you reach a highest generation or export day, week, or month of the year.',
    deliveryNote: 'Preference capture only — delivery coming soon',
  },
  {
    key: 'importAlerts',
    label: 'Import highlights',
    description: 'Highlight when you reach a highest or lowest import day, week, or month of the year.',
    deliveryNote: 'Preference capture only — delivery coming soon',
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        checked ? 'bg-indigo-600' : 'bg-slate-700',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

export function NotificationsForm({ initial, isSaved }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);

  function setKey(key: keyof NotificationPreferences, value: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveNotificationPreferences(prefs);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-5">
      {isSaved && !saved && (
        <div className="flex items-center gap-2 rounded-[16px] border border-emerald-800/30 bg-[#0d1f18] px-4 py-3">
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
          <p className="text-xs text-emerald-300">Preferences saved</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {CATEGORIES.map(({ key, label, description, deliveryNote }) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-800 bg-slate-900/50 px-4 py-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{label}</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
              {deliveryNote && (
                <p className="mt-1 text-xs text-slate-600 italic">{deliveryNote}</p>
              )}
            </div>
            <Toggle
              id={`toggle-${key}`}
              checked={prefs[key]}
              onChange={(v) => setKey(key, v)}
              disabled={isPending}
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-800/40 bg-red-950/30 px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800/30 bg-[#0d1f18] px-4 py-3">
          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
          <p className="text-xs text-emerald-300">Preferences saved</p>
        </div>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Save preferences
        </button>
      </div>
    </form>
  );
}
