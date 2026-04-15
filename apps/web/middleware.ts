import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { UserRole, UserStatus } from '@/src/user-constants';

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin bypasses all status-based routing
    if (token?.role === UserRole.Admin) {
      return NextResponse.next();
    }

    const status = token?.status;

    if (status === UserStatus.AwaitingApproval && pathname !== '/waiting') {
      return NextResponse.redirect(new URL('/waiting', req.url));
    }

    if (status === UserStatus.Suspended && pathname !== '/suspended') {
      return NextResponse.redirect(new URL('/suspended', req.url));
    }

    // Approved users without a valid provider connection must complete setup first.
    if (
      status === UserStatus.Approved &&
      token?.providerStatus !== 'active' &&
      pathname !== '/connect-provider'
    ) {
      return NextResponse.redirect(new URL('/connect-provider', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/sign-in',
    },
  },
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|api/auth|api/internal).*)',
  ],
};
