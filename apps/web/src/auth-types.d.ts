import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    userId: string;
    role: string;
    status: string;
    providerStatus: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    status?: string;
    /** 'active' if the user has a verified provider connection; 'none' otherwise. */
    providerStatus?: string;
  }
}
