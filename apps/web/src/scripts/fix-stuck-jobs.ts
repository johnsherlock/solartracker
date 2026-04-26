import { config } from 'dotenv';
config(); config({ path: '.env.local', override: true });
import { db } from '../db/client';
import { jobRuns } from '../db/schema';
import { isNull } from 'drizzle-orm';

async function main() {
  const stuck = await db.select({ id: jobRuns.id, installationId: jobRuns.installationId, metadataJson: jobRuns.metadataJson })
    .from(jobRuns).where(isNull(jobRuns.finishedAt));
  console.log(`Found ${stuck.length} stuck job(s):`, stuck.map(j => `${j.id} (${JSON.stringify(j.metadataJson)})`));

  if (stuck.length === 0) { process.exit(0); }

  const result = await db.update(jobRuns)
    .set({ status: 'failed', finishedAt: new Date(), errorSummary: 'Marked failed: process was interrupted before finishing' })
    .where(isNull(jobRuns.finishedAt));
  console.log('Updated stuck jobs to failed.');
  process.exit(0);
}
main().catch(console.error);
