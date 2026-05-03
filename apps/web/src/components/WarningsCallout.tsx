'use client';

import { AlertTriangle, X } from 'lucide-react';
import type { RangeSeriesDay } from '@/src/range/types';

type Props = {
  missingDays: number;
  partialDays: number;
  coveredDays: number;
  hasTariffChange: boolean;
  series: RangeSeriesDay[];
  onDismiss: () => void;
};

export function WarningsCallout({
  missingDays,
  partialDays,
  coveredDays,
  hasTariffChange,
  series,
  onDismiss,
}: Props) {
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
