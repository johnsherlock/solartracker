'use server';

import { eq } from 'drizzle-orm';
import { getSession } from '@/src/auth-helpers';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { UserStatus } from '@/src/user-constants';
import { searchLocationCandidates, resolveCandidate } from '@/src/location/geocoder';
import type { LocationCandidate } from '@/src/location/geocoder';

export type { LocationCandidate };

// The confirmed selection passed from the client to saveLocation.
export type ConfirmedLocation = {
  candidate: LocationCandidate;
};

export type SearchLocationsResult =
  | { ok: true; candidates: LocationCandidate[] }
  | { ok: false; error: string };

export type SaveLocationResult = { ok: true } | { ok: false; error: string };
export type ClearLocationResult = { ok: true } | { ok: false; error: string };

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
// Search — geocode only, no DB write. Called on debounced keystrokes.
// ---------------------------------------------------------------------------

export async function searchLocations(text: string): Promise<SearchLocationsResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  if (text.trim().length < 2) {
    return { ok: true, candidates: [] };
  }

  try {
    const candidates = await searchLocationCandidates(text.trim());
    return { ok: true, candidates };
  } catch {
    return { ok: false, error: 'Search failed. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Save — persist the user-confirmed selection
// ---------------------------------------------------------------------------

export async function saveLocation(confirmed: ConfirmedLocation): Promise<SaveLocationResult> {
  const session = await getSession();
  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { ok: false, error: 'Not authorised.' };
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return { ok: false, error: 'No installation found.' };

  const location = resolveCandidate(confirmed.candidate);
  const { db, installations } = await getDeps();

  await db
    .update(installations)
    .set({
      locationRawInput: confirmed.candidate.contextLabel,
      locationDisplayName: location.displayName,
      locationLatitude: String(location.latitude),
      locationLongitude: String(location.longitude),
      locationPrecisionMode: location.precisionMode,
      locationCountryCode: location.countryCode ?? null,
      locationLocality: location.locality ?? null,
      locationGeocodedAt: new Date(),
      locationGeocoderProvider: location.geocoderProvider,
      updatedAt: new Date(),
    })
    .where(eq(installations.id, installationId));

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

export async function clearLocation(): Promise<ClearLocationResult> {
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
      locationRawInput: null,
      locationDisplayName: null,
      locationLatitude: null,
      locationLongitude: null,
      locationPrecisionMode: null,
      locationCountryCode: null,
      locationLocality: null,
      locationGeocodedAt: null,
      locationGeocoderProvider: null,
      updatedAt: new Date(),
    })
    .where(eq(installations.id, installationId));

  return { ok: true };
}
