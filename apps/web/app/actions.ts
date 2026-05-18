'use server';

import { db } from '@/src/db/client';
import { waitlistEntries } from '@/src/db/schema';

export async function joinWaitlist(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const email = formData.get('email')?.toString().trim() ?? '';
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  try {
    await db
      .insert(waitlistEntries)
      .values({ email })
      .onConflictDoNothing();
    return { success: true };
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
}
