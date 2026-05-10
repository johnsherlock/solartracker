import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'admin_session';
const COOKIE_PATH = '/';
const TOKEN_EXPIRY = '8h';

function getSecret(): Uint8Array {
  const raw = process.env.ADMIN_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) throw new Error('ADMIN_SESSION_SECRET or NEXTAUTH_SECRET must be set');
  return new TextEncoder().encode(raw);
}

// ---------------------------------------------------------------------------
// Password hashing — Node crypto.scrypt, no extra dependency
// Stored as "salt:hash" (both hex-encoded).
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, storedHex] = stored.split(':');
  if (!salt || !storedHex) return false;
  const storedBuf = Buffer.from(storedHex, 'hex');
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return timingSafeEqual(storedBuf, hash);
}

// ---------------------------------------------------------------------------
// Admin session JWT — signed with jose
// ---------------------------------------------------------------------------

export interface AdminSession {
  adminId: string;
  username: string;
}

export async function createAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({ adminId: session.adminId, username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.adminId !== 'string' || typeof payload.username !== 'string') return null;
    return { adminId: payload.adminId, username: payload.username };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export async function setAdminSessionCookie(session: AdminSession): Promise<void> {
  const token = await createAdminToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: COOKIE_PATH,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/solaris');
  return session;
}
