import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';

// Each db.select() chain resolves to the next queued result, in call order.
const queuedResults: unknown[][] = [];
vi.mock('@/src/db/client', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(queuedResults.shift() ?? []),
  };
  return { db: { select: () => chain } };
});

const { authOptions } = await import('../auth');
const jwt = authOptions.callbacks!.jwt!;

function runUpdate(token: JWT) {
  return jwt({ token, trigger: 'update' } as Parameters<typeof jwt>[0]);
}

describe('jwt callback on session update', () => {
  beforeEach(() => {
    queuedResults.length = 0;
  });

  it('picks up an approval made since sign-in', async () => {
    queuedResults.push(
      [{ status: 'approved' }], // users
      [], // installations → no provider yet
    );
    const token = await runUpdate({ userId: 'u1', status: 'awaiting_approval', providerStatus: 'none' });
    expect(token.status).toBe('approved');
    expect(token.providerStatus).toBe('none');
  });

  it('refreshes provider status alongside user status', async () => {
    queuedResults.push(
      [{ status: 'approved' }], // users
      [{ id: 'inst-1' }], // installations
      [{ id: 'conn-1' }], // provider_connections
    );
    const token = await runUpdate({ userId: 'u1', status: 'approved', providerStatus: 'none' });
    expect(token.status).toBe('approved');
    expect(token.providerStatus).toBe('active');
  });

  it('keeps the existing status if the user row is missing', async () => {
    queuedResults.push([], []);
    const token = await runUpdate({ userId: 'u1', status: 'awaiting_approval', providerStatus: 'none' });
    expect(token.status).toBe('awaiting_approval');
  });
});
