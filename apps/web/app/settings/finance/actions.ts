'use server';

import { eq } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';
import { validateFinanceInputs } from '@/src/finance/finance-domain';

export type SaveFinanceInput = {
  investmentDate: string;
  upfrontPayment: string;
  monthlyRepayment: string;
  repaymentDurationMonths: string;
};

export type SaveFinanceResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type DbModule = typeof import('@/src/db/client');
type SchemaModule = typeof import('@/src/db/schema');

let _deps: Promise<{
  db: DbModule['db'];
  installations: SchemaModule['installations'];
}> | null = null;

async function getDeps() {
  if (!_deps) {
    _deps = Promise.all([import('@/src/db/client'), import('@/src/db/schema')]).then(
      ([client, schema]) => ({ db: client.db, installations: schema.installations }),
    );
  }
  return _deps;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function saveFinanceSettings(input: SaveFinanceInput): Promise<SaveFinanceResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const upfrontPayment = input.upfrontPayment !== '' ? parseFloat(input.upfrontPayment) : null;
  const monthlyRepayment =
    input.monthlyRepayment !== '' ? parseFloat(input.monthlyRepayment) : null;
  const repaymentDurationMonths =
    input.repaymentDurationMonths !== '' ? parseInt(input.repaymentDurationMonths, 10) : null;

  if (
    (upfrontPayment !== null && !Number.isFinite(upfrontPayment)) ||
    (monthlyRepayment !== null && !Number.isFinite(monthlyRepayment)) ||
    (repaymentDurationMonths !== null && (!Number.isInteger(repaymentDurationMonths) || repaymentDurationMonths < 1))
  ) {
    return { ok: false, error: 'Invalid numeric input.' };
  }

  const validation = validateFinanceInputs({
    investmentDate: input.investmentDate || null,
    upfrontPayment,
    monthlyRepayment,
    repaymentDurationMonths,
  });

  if (!validation.valid) {
    return { ok: false, error: validation.reason };
  }

  const { db, installations } = await getDeps();

  await db
    .update(installations)
    .set({
      financeInvestmentDate: input.investmentDate,
      financeMode: 'finance',
      installCostAmount: upfrontPayment != null ? String(upfrontPayment) : null,
      monthlyFinancePaymentAmount:
        monthlyRepayment != null ? String(monthlyRepayment) : null,
      financeTermMonths: repaymentDurationMonths,
      updatedAt: new Date(),
    })
    .where(eq(installations.id, installationId));

  return { ok: true };
}
