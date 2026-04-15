import type { MyEnergiCredentials } from './types';
import { decryptCredentialRef } from './credential-cipher';

/**
 * Resolve a stored credential reference to a concrete username/password pair.
 *
 * Supported reference formats:
 *
 *   env:USERNAME_ENV_KEY:PASSWORD_ENV_KEY
 *     Reads the named environment variables. Used for local development.
 *     Example: "env:MYENERGI_USERNAME:MYENERGI_PASSWORD"
 *
 *   aes256gcm:<base64>
 *     AES-256-GCM encrypted credential payload. Used for production per-user
 *     credentials stored via the connect-provider form. Key is read from
 *     CREDENTIAL_ENCRYPTION_KEY.
 *
 * Future formats (e.g. Vault paths, AWS Secrets Manager ARNs) can be
 * added here as new prefix cases without touching adapter code.
 *
 * Returns null if credentialRef is null/empty or if resolution fails.
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

  if (credentialRef.startsWith('aes256gcm:')) {
    const result = decryptCredentialRef(credentialRef);
    if (!result) {
      console.error('[myenergi-credentials] Failed to decrypt aes256gcm credential ref');
      return null;
    }
    return result;
  }

  console.error(`[myenergi-credentials] Unknown credential ref format: ${credentialRef}`);
  return null;
}
