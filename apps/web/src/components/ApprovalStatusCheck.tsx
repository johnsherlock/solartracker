'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserStatus } from '@/src/user-constants';

/**
 * The session token only records the user's status at sign-in, so a user who
 * is approved while still signed in would otherwise stay stuck on /waiting.
 * On mount, refresh the token from the database and move on if approved.
 */
export function ApprovalStatusCheck() {
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    let cancelled = false;
    update().then((session) => {
      if (!cancelled && session?.status && session.status !== UserStatus.AwaitingApproval) {
        // Middleware routes on from here (provider setup, suspended, or the app).
        router.replace('/live');
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once per visit to the waiting page.
  }, []);

  return null;
}
