import { Bell } from 'lucide-react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { db } from '@/src/db/client';
import { installations } from '@/src/db/schema';
import { NotificationsForm } from './NotificationsForm';
import type { NotificationPreferences } from './actions';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  tariffReminder: true,
  missingData: true,
  generationAlerts: true,
  importAlerts: true,
};

function parsePreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
  const p = raw as Record<string, unknown>;
  return {
    tariffReminder: p.tariffReminder !== false,
    missingData: p.missingData !== false,
    generationAlerts: p.generationAlerts !== false,
    importAlerts: p.importAlerts !== false,
  };
}

export default async function NotificationsPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const row = await db
    .select({ notificationPreferencesJson: installations.notificationPreferencesJson })
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const isSaved = row?.notificationPreferencesJson != null;
  const prefs = parsePreferences(row?.notificationPreferencesJson);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Bell size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Notifications</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose mb-8">
        Manage your notification preferences. Each category can be turned on or off
        independently. Some categories are preference capture only — delivery will be added in
        a future update.
      </p>

      <NotificationsForm initial={prefs} isSaved={isSaved} />
    </div>
  );
}
