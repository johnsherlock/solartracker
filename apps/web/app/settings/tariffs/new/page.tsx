import { redirect } from 'next/navigation';
import { loadTariffOverview } from '@/src/tariffs/loader';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import TariffEditor from '../_components/TariffEditor';
import type { TariffEditorInitialData } from '../_components/TariffEditor';

export const dynamic = 'force-dynamic';

export default async function NewTariffVersionPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const overview = await loadTariffOverview(installationId);

  const initial: TariffEditorInitialData = {
    supplierName: overview.plan?.supplierName ?? '',
    planName: overview.plan?.planName ?? '',
    validFromLocalDate: '',
    validToLocalDate: '',
    periods: [],
    schedule: new Array(336).fill(''),
    exportRate: '',
    vatRate: '',
    standingChargeAmount: '',
  };

  return (
    <TariffEditor
      mode="create"
      initial={initial}
      existingVersions={overview.allVersions}
    />
  );
}
