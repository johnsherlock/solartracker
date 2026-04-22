import { redirect, notFound } from 'next/navigation';
import { loadVersionForEdit } from '@/src/tariffs/loader';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import TariffEditor from '../../_components/TariffEditor';
import type { TariffEditorInitialData, EditorPeriod } from '../../_components/TariffEditor';

export const dynamic = 'force-dynamic';

export default async function EditTariffVersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const data = await loadVersionForEdit(versionId, installationId);
  if (!data) notFound();

  const { plan, version, allVersions } = data;

  const standingCharge =
    version.fixedCharges.find((c) => c.chargeType === 'standing_charge') ?? null;

  // Normalise to per-day
  let standingChargePerDay = '';
  if (standingCharge) {
    const amount = parseFloat(standingCharge.amount);
    if (!isNaN(amount)) {
      standingChargePerDay =
        standingCharge.unit === 'per_month'
          ? (amount / 30.44).toFixed(4)
          : amount.toFixed(4);
    }
  }

  // VAT rate stored as decimal (0.09); editor accepts percentage (9)
  const vatRatePct = version.vatRate
    ? (parseFloat(version.vatRate) * 100).toFixed(2).replace(/\.?0+$/, '')
    : '';

  const periods: EditorPeriod[] = version.pricePeriods.map((p) => ({
    id: p.id,
    periodLabel: p.periodLabel,
    // isFreeImport periods may have null rate in DB — treat as 0
    ratePerKwh: p.isFreeImport ? '0' : (p.ratePerKwh ?? ''),
    isFreeImport: p.isFreeImport,
    colourHex: p.colourHex ?? '#3b82f6',
  }));

  const initial: TariffEditorInitialData = {
    versionId: version.id,
    supplierName: plan.supplierName,
    planName: plan.planName,
    validFromLocalDate: version.validFromLocalDate,
    validToLocalDate: version.validToLocalDate ?? '',
    periods,
    schedule: (version.weeklyScheduleJson ?? new Array(336).fill('')) as string[],
    exportRate: version.exportRate ?? '',
    vatRate: vatRatePct,
    standingChargeAmount: standingChargePerDay,
  };

  return (
    <TariffEditor
      mode="edit"
      initial={initial}
      existingVersions={allVersions}
    />
  );
}
