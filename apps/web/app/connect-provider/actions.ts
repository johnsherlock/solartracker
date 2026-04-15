'use server';

import { getSession } from '@/src/auth-helpers';
import { db } from '@/src/db/client';
import { installations, providerConnections } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { validateMyEnergiCredentials } from '@/src/providers/myenergi/client';
import { encryptCredentials } from '@/src/providers/myenergi/credential-cipher';
import { UserStatus } from '@/src/user-constants';

export type ConnectProviderResult =
  | { success: true }
  | { success: false; error: string };

export async function connectProvider(formData: FormData): Promise<ConnectProviderResult> {
  const session = await getSession();

  if (!session?.userId || session.status !== UserStatus.Approved) {
    return { success: false, error: 'Not authorised.' };
  }

  const serialNumber = (formData.get('serialNumber') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null)?.trim() ?? '';

  if (!serialNumber || !password) {
    return { success: false, error: 'Serial number and API key are required.' };
  }

  // Validate credentials against the MyEnergi API before persisting anything.
  const validation = await validateMyEnergiCredentials({ serialNumber, password });

  if (!validation.valid) {
    if (validation.reason === 'auth-failure') {
      return {
        success: false,
        error: 'Invalid credentials. Check your serial number and API key and try again.',
      };
    }
    return {
      success: false,
      error: 'Could not reach the MyEnergi service. Please try again in a moment.',
    };
  }

  // Encrypt credentials for storage — throws if CREDENTIAL_ENCRYPTION_KEY is missing.
  let credentialRef: string;
  try {
    credentialRef = encryptCredentials(serialNumber, password);
  } catch (err) {
    console.error('[connect-provider] Encryption failed:', err);
    return { success: false, error: 'Server configuration error. Please contact support.' };
  }

  // Find the user's installation, creating a minimal one if none exists yet.
  const existingInstallations = await db
    .select({ id: installations.id })
    .from(installations)
    .where(eq(installations.userId, session.userId))
    .limit(1);

  let installationId: string;

  if (existingInstallations.length > 0) {
    installationId = existingInstallations[0].id;
  } else {
    const [created] = await db
      .insert(installations)
      .values({
        userId: session.userId,
        name: 'My Home',
        timezone: 'Europe/Dublin',
        providerType: 'myenergi',
      })
      .returning({ id: installations.id });
    installationId = created.id;
  }

  // Upsert the provider connection — insert or overwrite an existing row.
  const existing = await db
    .select({ id: providerConnections.id })
    .from(providerConnections)
    .where(eq(providerConnections.installationId, installationId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(providerConnections)
      .set({
        credentialRef,
        status: 'active',
        lastErrorCode: null,
        lastErrorSummary: null,
        updatedAt: new Date(),
      })
      .where(eq(providerConnections.id, existing[0].id));
  } else {
    await db.insert(providerConnections).values({
      installationId,
      providerType: 'myenergi',
      status: 'active',
      credentialRef,
    });
  }

  return { success: true };
}
