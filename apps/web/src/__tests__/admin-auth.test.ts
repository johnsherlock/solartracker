import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createAdminToken, verifyAdminToken } from '../admin-auth';

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each call (random salt)', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    expect(h1).not.toBe(h2);
    // Both must still verify correctly
    expect(await verifyPassword('same-password', h1)).toBe(true);
    expect(await verifyPassword('same-password', h2)).toBe(true);
  });

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyPassword('any', 'not-a-valid-hash')).toBe(false);
  });
});

describe('createAdminToken / verifyAdminToken', () => {
  const session = { adminId: 'abc-123', username: 'admin' };

  it('round-trips admin session through a JWT', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!';
    const token = await createAdminToken(session);
    const result = await verifyAdminToken(token);
    expect(result).toEqual(session);
  });

  it('returns null for a tampered token', async () => {
    process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-chars-long!!';
    const token = await createAdminToken(session);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(await verifyAdminToken(tampered)).toBeNull();
  });

  it('returns null for an empty string', async () => {
    expect(await verifyAdminToken('')).toBeNull();
  });
});
