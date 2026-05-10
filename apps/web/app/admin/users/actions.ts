'use server';

import { db } from '@/src/db/client';
import { users } from '@/src/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/src/admin-auth';
import { sendApprovalEmail } from '@/src/email/approval';
import { UserStatus } from '@/src/user-constants';

export async function approveUser(userId: string) {
  const adminSession = await requireAdminSession();

  const [approved] = await db
    .update(users)
    .set({
      status: UserStatus.Approved,
      approvedAt: new Date(),
      approvedBy: adminSession.adminId,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.status, UserStatus.AwaitingApproval)))
    .returning({ email: users.email });

  if (!approved) throw new Error('User not found or not awaiting approval');

  // Fire and forget — a delivery failure should not surface as a broken UI action.
  sendApprovalEmail(approved.email).catch((err) => {
    console.error('[approveUser] approval email failed:', err);
  });

  revalidatePath('/admin/users');
}

export async function startImpersonation(targetUserId: string) {
  await requireAdminSession();

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) throw new Error('User not found');

  const cookieStore = await cookies();
  cookieStore.set('impersonating_user_id', target.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  cookieStore.set('impersonating_user_email', target.email, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  redirect('/live');
}

export async function stopImpersonation() {
  await requireAdminSession();

  const cookieStore = await cookies();
  cookieStore.delete('impersonating_user_id');
  cookieStore.delete('impersonating_user_email');

  redirect('/admin/users');
}
