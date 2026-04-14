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
