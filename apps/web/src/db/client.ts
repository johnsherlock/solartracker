import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize the rewrite database client.');
  }
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool), pool };
}

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createClient();
  }
  return _client;
}

export const db = new Proxy({} as ReturnType<typeof createClient>['db'], {
  get(_target, prop) {
    return (getClient().db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return (getClient().pool as unknown as Record<string | symbol, unknown>)[prop];
  },
});
