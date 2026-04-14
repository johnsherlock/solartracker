'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/sign-in' })}
      className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-300"
    >
      Sign out
    </button>
  );
}
