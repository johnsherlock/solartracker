import Link from 'next/link';
import { Receipt, ArrowRight } from 'lucide-react';

export default function TariffsPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Receipt size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Tariffs</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose">
        Manage your electricity tariff history — import rates, export rates, standing charges,
        and contract dates. Tariff data is required for all cost and savings calculations.
      </p>

      <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
        <Receipt size={28} className="mx-auto mb-4 text-slate-700" />
        <p className="text-sm font-semibold text-slate-300">
          Full tariff management coming in the next story
        </p>
        <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto">
          You will be able to view your active tariff, manage historical versions,
          and set contract dates here.
        </p>
      </div>
    </div>
  );
}
