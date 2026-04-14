import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { db } from '@/src/db/client';
import { users } from '@/src/db/schema';
import { eq, or } from 'drizzle-orm';
import { UserRole, UserStatus } from '@/src/user-constants';

// Populated by signIn, consumed once by jwt — avoids a second DB round-trip per sign-in.
const signInCache = new Map<string, { id: string; role: string; status: string }>();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async signIn({ account, profile }) {
      if (!account || !profile?.email) return false;

      const googleSub = account.providerAccountId;
      const email = profile.email;
      const displayName = profile.name ?? null;

      const existing = await db
        .select({ id: users.id, role: users.role, status: users.status })
        .from(users)
        .where(or(eq(users.authUserId, googleSub), eq(users.email, email)))
        .limit(1);

      if (existing.length === 0) {
        const [inserted] = await db
          .insert(users)
          .values({
            authUserId: googleSub,
            email,
            displayName,
            role: UserRole.User,
            status: UserStatus.AwaitingApproval,
            termsAcceptedAt: new Date(),
          })
          .returning({ id: users.id, role: users.role, status: users.status });
        signInCache.set(googleSub, inserted);
      } else {
        // Ensure the real Google sub is stored (fixes seeded placeholder subs)
        await db
          .update(users)
          .set({ authUserId: googleSub, updatedAt: new Date() })
          .where(eq(users.id, existing[0].id));
        signInCache.set(googleSub, existing[0]);
      }

      return true;
    },

    async jwt({ token, account }) {
      if (account) {
        const googleSub = account.providerAccountId;
        const cached = signInCache.get(googleSub);
        if (cached) {
          signInCache.delete(googleSub);
          token.userId = cached.id;
          token.role = cached.role;
          token.status = cached.status;
        } else {
          // Fallback for edge cases where signIn cache was missed
          const rows = await db
            .select({ id: users.id, role: users.role, status: users.status })
            .from(users)
            .where(eq(users.authUserId, googleSub))
            .limit(1);
          if (rows[0]) {
            token.userId = rows[0].id;
            token.role = rows[0].role;
            token.status = rows[0].status;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.userId = token.userId as string;
      session.role = token.role as string;
      session.status = token.status as string;
      return session;
    },
  },

  pages: {
    signIn: '/sign-in',
  },
};
