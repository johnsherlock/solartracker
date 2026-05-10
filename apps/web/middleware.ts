import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
import { jwtVerify } from 'jose';
import { UserStatus } from '@/src/user-constants';

function getAdminSecret(): Uint8Array {
  const raw = process.env.ADMIN_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error('ADMIN_SESSION_SECRET or NEXTAUTH_SECRET must be set');
  return new TextEncoder().encode(raw);
}

async function isValidAdminSession(req: NextRequestWithAuth): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getAdminSecret());
    return true;
  } catch {
    return false;
  }
}

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Admin impersonation check runs before token-based routing. A stale NextAuth
    // cookie must not redirect the operator away from the user-facing route they
    // are intentionally viewing as an impersonated user.
    const adminValid = await isValidAdminSession(req);
    const impersonating = req.cookies.has('impersonating_user_id');
    if (adminValid && impersonating) return NextResponse.next();

    if (!token) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
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
      // Always run the middleware function so it can check the admin session cookie.
      authorized: () => true,
    },
    pages: {
      signIn: '/sign-in',
    },
  },
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sign-in|solaris|admin|api/auth|api/internal).*)',
  ],
};
