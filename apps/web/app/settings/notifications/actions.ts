'use server';

import { eq } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';

export type NotificationPreferences = {
  tariffReminder: boolean;
  missingData: boolean;
  generationAlerts: boolean;
  importAlerts: boolean;
};

export type NotificationPreferencesResult =
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
// Save
// ---------------------------------------------------------------------------

export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferencesResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const { db, installations } = await getDeps();

  await db
    .update(installations)
    .set({
      notificationPreferencesJson: prefs,
      updatedAt: new Date(),
    })
    .where(eq(installations.id, installationId));

  return { ok: true };
}
