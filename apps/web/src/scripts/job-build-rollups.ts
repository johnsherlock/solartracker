/**
 * Builds daily_priced_rollups from existing interval_readings.
 *
 * Does NOT call the provider API — only reads from the local DB and writes
 * to daily_priced_rollups. Safe to run at any time without side effects.
 *
 * Usage:
 *
 *   # Build rollups for all installations, last 30 days
 *   npm run job:build-rollups
 *
 *   # Build rollups from a specific date
 *   npm run job:build-rollups -- --from 2023-01-01
 *
 *   # Build rollups for a single user
 *   npm run job:build-rollups -- --user alice@example.com
 *
 *   # Combined
 *   npm run job:build-rollups -- --user alice@example.com --from 2023-01-01
 */

import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });

import { runRollupCatchUp } from '../jobs/daily-summary';

const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const fromArg = getArgValue('--from');
const userArg = getArgValue('--user');

async function main() {
  const scope = userArg ? ` for ${userArg}` : '';
  console.log(
    fromArg
      ? `[job-cli] Building rollups${scope} from ${fromArg}…`
      : `[job-cli] Building rollups${scope} for the last 30 days…`,
  );
  await runRollupCatchUp({ fromDate: fromArg, userEmail: userArg });
}

main().catch((err) => {
  console.error('[job-cli] Fatal error:', err);
  process.exit(1);
});
