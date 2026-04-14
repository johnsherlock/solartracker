'use client';

// next-auth v4 SessionProvider has a React 19 type incompatibility where its
// return type is Element rather than ReactNode. Cast via unknown to work around it.
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import type { ReactNode } from 'react';

const Provider = NextAuthSessionProvider as unknown as (
  props: { session: Session | null; children: ReactNode }
) => ReactNode;

export function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return <Provider session={session}>{children}</Provider>;
}
