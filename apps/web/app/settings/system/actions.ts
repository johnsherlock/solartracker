'use server';

import { eq } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';

export type SystemCapacityResult =
  | { ok: true }
  | { ok: false; error: string };

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

export async function saveSystemCapacity(
  capacityKwRaw: string,
): Promise<SystemCapacityResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const capacityKw = capacityKwRaw.trim() !== '' ? parseFloat(capacityKwRaw) : null;
  if (capacityKw !== null && (!Number.isFinite(capacityKw) || capacityKw <= 0)) {
    return { ok: false, error: 'Capacity must be a positive number.' };
  }

  const { db, installations } = await getDeps();
  await db
    .update(installations)
    .set({
      arrayCapacityKw: capacityKw != null ? String(capacityKw) : null,
      updatedAt: new Date(),
    })
    .where(eq(installations.id, installationId));

  return { ok: true };
}
