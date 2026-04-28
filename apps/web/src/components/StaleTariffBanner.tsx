import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { StaleTariffWarning } from '@/src/tariffs/stale-check';

function bannerText(warning: StaleTariffWarning & { stale: true }): string {
  if (warning.daysRemaining === null) {
    return 'Your tariff has expired. Savings and cost figures may be inaccurate.';
  }
  if (warning.daysRemaining === 0) {
    return 'Your tariff expires today. Update it to keep calculations accurate.';
  }
  return `Your tariff expires in ${warning.daysRemaining} day${warning.daysRemaining !== 1 ? 's' : ''}. Update it to keep calculations accurate.`;
}

export function StaleTariffBanner({ warning }: { warning: StaleTariffWarning }) {
  if (!warning.stale) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-[16px] border border-amber-700/40 bg-amber-950/30 px-4 py-3">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-amber-300 leading-relaxed">{bannerText(warning)}</p>
      </div>
      <Link
        href="/settings/tariffs"
        className="shrink-0 inline-flex items-center rounded-full border border-amber-700/50 px-3 py-1 text-xs font-medium text-amber-300 hover:border-amber-600 hover:text-amber-200 transition-colors"
      >
        Update tariff
      </Link>
    </div>
  );
}
