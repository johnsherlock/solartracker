import { Zap } from 'lucide-react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { db } from '@/src/db/client';
import { installations } from '@/src/db/schema';
import SystemCapacityForm from './SystemCapacityForm';

export default async function SystemPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const row = await db
    .select({ arrayCapacityKw: installations.arrayCapacityKw })
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const currentCapacityKw = row?.arrayCapacityKw != null ? String(row.arrayCapacityKw) : '';

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Zap size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">System</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose mb-8">
        Set the total peak output capacity of your solar array. This unlocks solar yield
        interpretation on the live and history views, showing how close your system is running to
        its rated capacity.
      </p>

      <SystemCapacityForm currentCapacityKw={currentCapacityKw} />
    </div>
  );
}
