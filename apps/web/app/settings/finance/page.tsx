import { redirect } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { loadFinanceSettings } from '@/src/finance/loader';
import FinanceForm from './FinanceForm';

export default async function FinancePage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const payload = await loadFinanceSettings(installationId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Finance</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-prose">
        Record how your solar installation was paid for. This unlocks the payback progress
        tracker, showing how your solar savings are contributing toward recovering your investment.
      </p>

      <FinanceForm initialPayload={payload} />
    </div>
  );
}
