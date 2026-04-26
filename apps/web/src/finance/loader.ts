import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { installations, systemAdditions } from '../db/schema';
import { buildFinanceSettingsPayload } from './finance-domain';
import { buildSystemAdditionsPayload } from './system-addition-domain';
import type { FinanceSettingsPayload } from './finance-types';
import type { SystemAdditionsSettingsPayload } from './system-addition-types';

export async function loadFinanceSettings(
  installationId: string,
): Promise<FinanceSettingsPayload> {
  const row = await db
    .select({
      financeInvestmentDate: installations.financeInvestmentDate,
      installCostAmount: installations.installCostAmount,
      monthlyFinancePaymentAmount: installations.monthlyFinancePaymentAmount,
      financeTermMonths: installations.financeTermMonths,
    })
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return { configured: false };
  }

  return buildFinanceSettingsPayload({
    investmentDate: row.financeInvestmentDate ?? null,
    upfrontPayment: row.installCostAmount != null ? Number(row.installCostAmount) : null,
    monthlyRepayment:
      row.monthlyFinancePaymentAmount != null
        ? Number(row.monthlyFinancePaymentAmount)
        : null,
    repaymentDurationMonths: row.financeTermMonths ?? null,
  });
}

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
