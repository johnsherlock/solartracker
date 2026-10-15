/**
 * Creates the operator admin login, or resets its password if the username
 * already exists. Touches only `admin_users` — unlike `db:seed`, it inserts no
 * fixture users, installations, or summaries, so it is safe for production.
 *
 * Usage:
 *
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=... npm run db:create-admin
 *
 *   # Against a hosted database (values passed on the command line win over
 *   # .env / .env.local, so this cannot silently hit the local database):
 *   DATABASE_URL='postgres://...' ADMIN_USERNAME=admin ADMIN_PASSWORD=... npm run db:create-admin
 */

import './load-env';

import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { adminUsers } from '../db/schema';
import { hashPassword } from '../admin-auth';

function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!username || !password) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  console.log(`[create-admin] Target database: ${describeTarget(databaseUrl)}`);

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(adminUsers)
    .values({ username, passwordHash, displayName: 'Admin' })
    .onConflictDoUpdate({
      target: adminUsers.username,
      set: { passwordHash: sql`excluded.password_hash`, updatedAt: new Date() },
    })
    .returning({ id: adminUsers.id, createdAt: adminUsers.createdAt, updatedAt: adminUsers.updatedAt });

  const created = row.createdAt.getTime() === row.updatedAt.getTime();
  console.log(`[create-admin] ${created ? 'Created' : 'Updated password for'} admin "${username}".`);
}

main()
  .catch((err) => {
    console.error(`[create-admin] ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
