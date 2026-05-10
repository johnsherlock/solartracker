import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/auth';
import { getAdminSession, requireAdminSession } from '@/src/admin-auth';

export const getSession = () => getServerSession(authOptions);

export { requireAdminSession };

/**
 * Returns the user ID that should be used to load data for the current request.
 * When an admin has started impersonation, returns the impersonated user's ID.
 * Otherwise returns the real signed-in session user's ID, or null if not authenticated.
 */
export async function resolveEffectiveUserId(): Promise<string | null> {
  // Check admin impersonation first — admin session + impersonation cookie takes precedence.
  const adminSession = await getAdminSession();
  if (adminSession) {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('impersonating_user_id')?.value;
    if (impersonatedId) return impersonatedId;
    // Admin without impersonation has no end-user data context.
    return null;
  }

  const session = await getSession();
  return session?.userId ?? null;
}
