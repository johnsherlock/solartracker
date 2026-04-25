import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { installations } from '../db/schema';
import { buildFinanceSettingsPayload } from './finance-domain';
import type { FinanceSettingsPayload } from './finance-types';

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
