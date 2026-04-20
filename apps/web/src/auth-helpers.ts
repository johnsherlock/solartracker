import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/auth';

export const getSession = () => getServerSession(authOptions);

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Returns the user ID that should be used to load data for the current request.
 * When an admin has started impersonation, returns the impersonated user's ID.
 * Otherwise returns the real signed-in session user's ID, or null if not authenticated.
 */
export async function resolveEffectiveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  // Only honour the impersonation cookie when the real session is an admin.
  // This prevents a stale cookie from switching data context for non-admin users.
  if (session.role === 'admin') {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonating_user_id')?.value;
    if (impersonatedId) return impersonatedId;
  }

  return session.userId;
}
