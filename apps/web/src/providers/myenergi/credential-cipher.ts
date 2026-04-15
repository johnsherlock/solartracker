/**
 * AES-256-GCM encryption for stored MyEnergi credentials.
 *
 * Produces a `credentialRef` of the form:
 *   aes256gcm:<base64(iv:authTag:ciphertext)>
 *
 * The key is read from CREDENTIAL_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * If the key is absent, encryption throws rather than silently downgrading.
 *
 * The decryptor returns null on any parse or decryption error — callers
 * treat null as "no usable credentials" and surface the appropriate error.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'aes256gcm:';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[credential-cipher] CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a MyEnergi serial number + password pair.
 * Returns a credential reference string safe to store in provider_connections.credential_ref.
 */
export function encryptCredentials(serialNumber: string, password: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify({ serialNumber, password });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv | authTag | ciphertext, base64-encode the whole blob
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + packed.toString('base64');
}

/**
 * Decrypt a credential reference produced by encryptCredentials.
 * Returns null if the ref is missing, has the wrong prefix, or fails to decrypt.
 */
export function decryptCredentialRef(
  ref: string | null | undefined,
): { serialNumber: string; password: string } | null {
  if (!ref || !ref.startsWith(PREFIX)) return null;

  let key: Buffer;
  try {
    key = getKey();
  } catch {
    console.error('[credential-cipher] Cannot decrypt: encryption key unavailable');
    return null;
  }

  const b64 = ref.slice(PREFIX.length);
  let packed: Buffer;
  try {
    packed = Buffer.from(b64, 'base64');
  } catch {
    console.error('[credential-cipher] Cannot decrypt: base64 decode failed');
    return null;
  }

  if (packed.length < IV_BYTES + TAG_BYTES + 1) {
    console.error('[credential-cipher] Cannot decrypt: packed buffer too short');
    return null;
  }

  const iv = packed.subarray(0, IV_BYTES);
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plain = decipher.update(ciphertext) + decipher.final('utf8');
    const parsed = JSON.parse(plain) as { serialNumber: string; password: string };
    if (typeof parsed.serialNumber !== 'string' || typeof parsed.password !== 'string') {
      console.error('[credential-cipher] Cannot decrypt: unexpected payload shape');
      return null;
    }
    return { serialNumber: parsed.serialNumber, password: parsed.password };
  } catch {
    console.error('[credential-cipher] Decryption failed (wrong key or corrupted data)');
    return null;
  }
}

