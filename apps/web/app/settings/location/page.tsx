import { MapPin } from 'lucide-react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { db } from '@/src/db/client';
import { installations } from '@/src/db/schema';
import { LocationForm } from './LocationForm';

export default async function LocationPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');

  const row = await db
    .select({
      locationRawInput: installations.locationRawInput,
      locationDisplayName: installations.locationDisplayName,
      locationPrecisionMode: installations.locationPrecisionMode,
      locationLatitude: installations.locationLatitude,
      locationLongitude: installations.locationLongitude,
    })
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const current = row
    ? {
        rawInput: row.locationRawInput,
        displayName: row.locationDisplayName,
        precisionMode: row.locationPrecisionMode,
        latitude: row.locationLatitude,
        longitude: row.locationLongitude,
      }
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <MapPin size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Location</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose mb-8">
        Set your installation location to enable weather context and solar yield interpretation.
        Only a city or town is needed.
      </p>

      <LocationForm current={current} />
    </div>
  );
}
