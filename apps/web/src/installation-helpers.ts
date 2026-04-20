// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type DbModule = typeof import('./db/client');
type SchemaModule = typeof import('./db/schema');

let _deps: Promise<{
  db: DbModule['db'];
  installations: SchemaModule['installations'];
}> | null = null;

async function getDeps() {
  if (!_deps) {
    _deps = Promise.all([import('./db/client'), import('./db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        installations: schema.installations,
      }),
    );
  }
  return _deps;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first installation ID for the given internal user ID, or null
 * if no installation exists yet.
 */
export async function loadInstallationId(userId: string): Promise<string | null> {
  const { db, installations } = await getDeps();
  const { eq } = await import('drizzle-orm');
  const rows = await db
    .select({ id: installations.id })
    .from(installations)
    .where(eq(installations.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}
