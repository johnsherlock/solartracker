import type { MyEnergiCredentials } from './types';

/**
 * Resolve a stored credential reference to a concrete username/password pair.
 *
 * Supported reference formats:
 *
 *   env:USERNAME_ENV_KEY:PASSWORD_ENV_KEY
 *     Reads the named environment variables. Used for local development.
 *     Example: "env:MYENERGI_USERNAME:MYENERGI_PASSWORD"
 *
 * Future formats (e.g. Vault paths, AWS Secrets Manager ARNs) can be
 * added here as new prefix cases without touching adapter code.
 *
 * Returns null if credentialRef is null/empty or if required env vars
 * are missing.
 */
export function resolveMyEnergiCredentials(
  credentialRef: string | null | undefined,
): MyEnergiCredentials | null {
  if (!credentialRef) return null;

  if (credentialRef.startsWith('env:')) {
    const parts = credentialRef.split(':');
    if (parts.length !== 3) {
      console.error(`[myenergi-credentials] Invalid env ref format: ${credentialRef}`);
      return null;
    }
    const usernameKey = parts[1];
    const passwordKey = parts[2];
    const serialNumber = process.env[usernameKey];
    const password = process.env[passwordKey];
    if (!serialNumber || !password) {
      console.error(
        `[myenergi-credentials] Missing env vars: ${usernameKey}, ${passwordKey}`,
      );
      return null;
    }
    return { serialNumber, password };
  }

  console.error(`[myenergi-credentials] Unknown credential ref format: ${credentialRef}`);
  return null;
}
