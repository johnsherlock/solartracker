import { TrendingUp } from 'lucide-react';

export default function FinancePage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Finance</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose">
        Configure your installation finance mode — cash purchase or financed — along with
        monthly payment amount and term. This data powers the payback progress tracker.
      </p>

      <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
        <TrendingUp size={28} className="mx-auto mb-4 text-slate-700" />
        <p className="text-sm font-semibold text-slate-300">Coming soon</p>
        <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto">
          Finance details will be configurable here in a future update.
          Once set up, the payback progress tracker will show how your solar
          savings are tracking against your finance payments.
        </p>
      </div>
    </div>
  );
}
