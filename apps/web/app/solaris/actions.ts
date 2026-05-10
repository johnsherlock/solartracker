'use server';

import { db } from '@/src/db/client';
import { adminUsers } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import {
  verifyPassword,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from '@/src/admin-auth';

export async function loginAdmin(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    redirect('/solaris?error=invalid');
  }

  const [admin] = await db
    .select({ id: adminUsers.id, username: adminUsers.username, passwordHash: adminUsers.passwordHash })
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1);

  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    redirect('/solaris?error=invalid');
  }

  await setAdminSessionCookie({ adminId: admin.id, username: admin.username });
  redirect('/admin/users');
}

export async function logoutAdmin() {
  await clearAdminSessionCookie();
  redirect('/solaris');
}
