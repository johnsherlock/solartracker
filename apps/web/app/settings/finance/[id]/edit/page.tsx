import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TrendingUp, ChevronLeft } from 'lucide-react';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { loadSystemAdditionsSettings } from '@/src/finance/loader';
import SystemAdditionForm from '../../_components/SystemAdditionForm';

export default async function EditSystemAdditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const payload = await loadSystemAdditionsSettings(installationId);
  if (!payload.configured) notFound();

  const record = payload.records.find((r) => r.id === id);
  if (!record) notFound();

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
        <h1 className="text-lg font-semibold text-slate-100">Edit system addition</h1>
      </div>

      <SystemAdditionForm mode="edit" record={record} />
    </div>
  );
}
