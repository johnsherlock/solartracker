import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { systemAdditions } from '../db/schema';
import { buildSystemAdditionsPayload } from './system-addition-domain';
import type { SystemAdditionsSettingsPayload } from './system-addition-types';

export async function loadSystemAdditionsSettings(
  installationId: string,
): Promise<SystemAdditionsSettingsPayload> {
  const rows = await db
    .select({
      id: systemAdditions.id,
      label: systemAdditions.label,
      additionDate: systemAdditions.additionDate,
      capacityAddedKw: systemAdditions.capacityAddedKw,
      upfrontPayment: systemAdditions.upfrontPayment,
      monthlyRepayment: systemAdditions.monthlyRepayment,
      repaymentDurationMonths: systemAdditions.repaymentDurationMonths,
    })
    .from(systemAdditions)
    .where(eq(systemAdditions.installationId, installationId))
    .orderBy(asc(systemAdditions.additionDate));

  return buildSystemAdditionsPayload(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      additionDate: r.additionDate,
      capacityAddedKw: r.capacityAddedKw != null ? Number(r.capacityAddedKw) : null,
      upfrontPayment: r.upfrontPayment != null ? Number(r.upfrontPayment) : null,
      monthlyRepayment: r.monthlyRepayment != null ? Number(r.monthlyRepayment) : null,
      repaymentDurationMonths: r.repaymentDurationMonths ?? null,
    })),
  );
}
