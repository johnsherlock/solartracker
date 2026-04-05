/**
 * Local CLI entry point for daily-summary job scripts.
 *
 * Usage:
 *
 *   # Summarise the previous local day for all active installations
 *   npm run job:daily-summary
 *
 *   # Summarise a specific date (YYYY-MM-DD)
 *   npm run job:daily-summary -- --date 2024-03-31
 *
 *   # Catch-up: summarise all missing days for the last 30 days
 *   npm run job:catch-up
 *
 *   # Catch-up from a specific date
 *   npm run job:catch-up -- --from 2024-01-01
 *
 * Environment:
 *   Requires DATABASE_URL and a valid provider credential ref in the DB.
 *   Loads .env automatically via dotenv/config (imported by db/client).
 */

import { config } from 'dotenv';
// Load .env then .env.local (later file wins), matching Next.js local-dev behaviour.
config();
config({ path: '.env.local', override: true });
import { runDailySummaryJob, runCatchUp } from '../jobs/daily-summary';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isCatchUp = args.includes('--catch-up');

function getArgValue(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const dateArg = getArgValue('--date');
const fromArg = getArgValue('--from');

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  if (isCatchUp) {
    console.log(
      fromArg
        ? `[job-cli] Running catch-up from ${fromArg}…`
        : '[job-cli] Running catch-up for the last 30 days…',
    );
    await runCatchUp({ fromDate: fromArg });
    return;
  }

  if (dateArg) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
      console.error(`[job-cli] Invalid --date format. Expected YYYY-MM-DD, got: ${dateArg}`);
      process.exit(1);
    }
    console.log(`[job-cli] Running daily-summary job for ${dateArg}…`);
    const result = await runDailySummaryJob({ targetDate: dateArg, skipEligibilityCheck: true });
    printResult(result);
    return;
  }

  // Default: summarise previous local day.
  console.log('[job-cli] Running daily-summary job for yesterday…');
  const result = await runDailySummaryJob({ skipEligibilityCheck: true });
  printResult(result);
}

function printResult(result: Awaited<ReturnType<typeof runDailySummaryJob>>) {
  for (const o of result.outcomes) {
    const tag = o.status === 'success' ? '✓' : o.status === 'skipped' ? '–' : '✗';
    const detail =
      o.status === 'success'
        ? `${o.readingsCount} readings${o.isPartial ? ' (partial)' : ''}`
        : o.errorSummary ?? '';
    console.log(`  ${tag} [${o.installationId}] ${o.targetDate}  ${detail}`);
  }
  console.log(
    `\n  success=${result.successCount}  skipped=${result.skippedCount}  failed=${result.failedCount}`,
  );
  if (result.failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[job-cli] Fatal error:', err);
  process.exit(1);
});
