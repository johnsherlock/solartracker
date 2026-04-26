'use server';

import { eq, and } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';
import { validateSystemAdditionInputs } from '@/src/finance/system-addition-domain';

export type SystemAdditionInput = {
  label: string;
  additionDate: string;
  capacityAddedKw: string;
  upfrontPayment: string;
  monthlyRepayment: string;
  repaymentDurationMonths: string;
};

export type SystemAdditionResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type DbModule = typeof import('@/src/db/client');
type SchemaModule = typeof import('@/src/db/schema');

let _deps: Promise<{
  db: DbModule['db'];
  systemAdditions: SchemaModule['systemAdditions'];
}> | null = null;

async function getDeps() {
  if (!_deps) {
    _deps = Promise.all([import('@/src/db/client'), import('@/src/db/schema')]).then(
      ([client, schema]) => ({ db: client.db, systemAdditions: schema.systemAdditions }),
    );
  }
  return _deps;
}

// ---------------------------------------------------------------------------
// Shared parse + validate
// ---------------------------------------------------------------------------

function parseAndValidate(input: SystemAdditionInput): {
  ok: true;
  data: {
    label: string;
    additionDate: string;
    capacityAddedKw: string | null;
    upfrontPayment: string | null;
    monthlyRepayment: string | null;
    repaymentDurationMonths: number | null;
  };
} | { ok: false; error: string } {
  const upfrontPayment = input.upfrontPayment !== '' ? parseFloat(input.upfrontPayment) : null;
  const monthlyRepayment = input.monthlyRepayment !== '' ? parseFloat(input.monthlyRepayment) : null;
  const repaymentDurationMonths =
    input.repaymentDurationMonths !== '' ? parseInt(input.repaymentDurationMonths, 10) : null;
  const capacityAddedKw = input.capacityAddedKw !== '' ? parseFloat(input.capacityAddedKw) : null;

  if (upfrontPayment !== null && !Number.isFinite(upfrontPayment)) {
    return { ok: false, error: 'Invalid upfront payment amount.' };
  }
  if (monthlyRepayment !== null && !Number.isFinite(monthlyRepayment)) {
    return { ok: false, error: 'Invalid monthly repayment amount.' };
  }
  if (
    repaymentDurationMonths !== null &&
    (!Number.isInteger(repaymentDurationMonths) || repaymentDurationMonths < 1)
  ) {
    return { ok: false, error: 'Repayment duration must be a whole number of months.' };
  }
  if (capacityAddedKw !== null && !Number.isFinite(capacityAddedKw)) {
    return { ok: false, error: 'Invalid capacity value.' };
  }

  const validation = validateSystemAdditionInputs({
    label: input.label,
    additionDate: input.additionDate,
    capacityAddedKw,
    upfrontPayment,
    monthlyRepayment,
    repaymentDurationMonths,
  });

  if (!validation.valid) {
    return { ok: false, error: validation.reason };
  }

  return {
    ok: true,
    data: {
      label: input.label.trim(),
      additionDate: input.additionDate,
      capacityAddedKw: capacityAddedKw != null ? String(capacityAddedKw) : null,
      upfrontPayment: upfrontPayment != null ? String(upfrontPayment) : null,
      monthlyRepayment: monthlyRepayment != null ? String(monthlyRepayment) : null,
      repaymentDurationMonths,
    },
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSystemAddition(
  input: SystemAdditionInput,
): Promise<SystemAdditionResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const parsed = parseAndValidate(input);
  if (!parsed.ok) return parsed;

  const { db, systemAdditions } = await getDeps();

  await db.insert(systemAdditions).values({
    installationId,
    label: parsed.data.label,
    additionDate: parsed.data.additionDate,
    capacityAddedKw: parsed.data.capacityAddedKw,
    upfrontPayment: parsed.data.upfrontPayment,
    monthlyRepayment: parsed.data.monthlyRepayment,
    repaymentDurationMonths: parsed.data.repaymentDurationMonths,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateSystemAddition(
  id: string,
  input: SystemAdditionInput,
): Promise<SystemAdditionResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const parsed = parseAndValidate(input);
  if (!parsed.ok) return parsed;

  const { db, systemAdditions } = await getDeps();

  const result = await db
    .update(systemAdditions)
    .set({
      label: parsed.data.label,
      additionDate: parsed.data.additionDate,
      capacityAddedKw: parsed.data.capacityAddedKw,
      upfrontPayment: parsed.data.upfrontPayment,
      monthlyRepayment: parsed.data.monthlyRepayment,
      repaymentDurationMonths: parsed.data.repaymentDurationMonths,
      updatedAt: new Date(),
    })
    .where(and(eq(systemAdditions.id, id), eq(systemAdditions.installationId, installationId)));

  if (result.rowCount === 0) {
    return { ok: false, error: 'Record not found.' };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteSystemAddition(id: string): Promise<SystemAdditionResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const { db, systemAdditions } = await getDeps();

  const result = await db
    .delete(systemAdditions)
    .where(and(eq(systemAdditions.id, id), eq(systemAdditions.installationId, installationId)));

  if (result.rowCount === 0) {
    return { ok: false, error: 'Record not found.' };
  }

  return { ok: true };
}
