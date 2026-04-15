import { Zap } from 'lucide-react';

export default function SolarPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Zap size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Solar details</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose">
        Record your solar installation details — array capacity (kWp), installation date,
        and configuration. This data unlocks efficiency and yield comparison views.
      </p>

      <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
        <Zap size={28} className="mx-auto mb-4 text-slate-700" />
        <p className="text-sm font-semibold text-slate-300">Coming soon</p>
        <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto">
          Solar installation details will be configurable here in a future update.
          Once set up, you will be able to see efficiency metrics and yield comparisons
          alongside your energy data.
        </p>
      </div>
    </div>
  );
}
