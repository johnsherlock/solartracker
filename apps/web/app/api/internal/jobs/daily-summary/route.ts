/**
 * POST /api/internal/jobs/daily-summary
 *
 * Secure internal entrypoint for the daily-summary cron job.
 *
 * Authentication:
 *   Vercel sets CRON_SECRET in the deployment environment and automatically
 *   includes `Authorization: Bearer <CRON_SECRET>` on every cron invocation.
 *   Manual or local callers must send the same header.
 *
 * Cron schedule (vercel.json):
 *   "15 0 * * *"  — 00:15 UTC
 *   In winter (Europe/Dublin = UTC):     00:15 local — 15 min after midnight
 *   In summer (Europe/Dublin = UTC+1):  01:15 local — 75 min after midnight
 *   Both are safely past midnight for Ireland-only beta installations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailySummaryJob } from '../../../../../src/jobs/daily-summary';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ----- Auth -----
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[daily-summary-job] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ----- Run -----
  console.log('[daily-summary-job] Starting job…');

  let result;
  try {
    result = await runDailySummaryJob();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[daily-summary-job] Unexpected error: ${message}`);
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 });
  }

  console.log(
    `[daily-summary-job] Done. success=${result.successCount} skipped=${result.skippedCount} failed=${result.failedCount}`,
  );

  const statusCode = result.failedCount > 0 && result.successCount === 0 ? 500 : 200;

  return NextResponse.json(result, { status: statusCode });
}
