import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TrendingUp, ChevronLeft } from 'lucide-react';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import SystemAdditionForm from '../_components/SystemAdditionForm';

export default async function NewSystemAdditionPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link
          href="/settings/finance"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={12} />
          System additions
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6 mt-4">
        <TrendingUp size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Add system addition</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed mb-8 max-w-prose">
        Record a new addition to your solar system — the original install, a panel expansion,
        or any other dated investment. At least one payment field is required.
      </p>

      <SystemAdditionForm mode="create" />
    </div>
  );
}
