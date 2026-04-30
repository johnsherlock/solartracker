/**
 * Core daily-summary job.
 *
 * runDailySummaryJob() is the single shared implementation called by:
 *   - the Vercel cron entrypoint (POST /api/internal/jobs/daily-summary)
 *   - the local CLI scripts (job:daily-summary, job:catch-up)
 *
 * It queries all active MyEnergi installations, fetches the previous local day
 * from the MyEnergi API, aggregates minute readings into 30-minute slots, and
 * upserts up to 48 interval_readings rows per installation per day.
 *
 * Tariff rates are no longer applied at write time — they are resolved at
 * query time in the range read path.
 */

import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  installations,
  providerConnections,
  intervalReadings,
  jobRuns,
  users,
} from '../db/schema';
import { fetchDayRecords } from '../providers/myenergi/client';
import { normaliseEddiRecords } from '../providers/myenergi/adapter';
import { resolveMyEnergiCredentials } from '../providers/myenergi/credentials';
import {
  getPreviousLocalDate,
  isAfterMidnightBuffer,
  expectedMinutesForDay,
  utcStartOfLocalDate,
  aggregateToIntervalReadings,
  type IntervalSlot,
} from './derive-summary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstallationJobOutcome = {
  installationId: string;
  timezone: string;
  targetDate: string;
  status: 'success' | 'skipped' | 'failed';
  readingsCount?: number;
  isPartial?: boolean;
  errorCode?: string;
  errorSummary?: string;
};

export type DailySummaryJobResult = {
  triggeredAt: string;
  outcomes: InstallationJobOutcome[];
  successCount: number;
  skippedCount: number;
  failedCount: number;
};

// ---------------------------------------------------------------------------
// Eligibility query
// ---------------------------------------------------------------------------

type ActiveInstallation = {
  installationId: string;
  timezone: string;
  providerConnectionId: string;
  credentialRef: string | null;
};

async function loadActiveInstallations(userEmail?: string): Promise<ActiveInstallation[]> {
  const conditions = [
    eq(providerConnections.providerType, 'myenergi'),
    eq(providerConnections.status, 'active'),
  ];

  const rows = await db
    .select({
      installationId: installations.id,
      timezone: installations.timezone,
      providerConnectionId: providerConnections.id,
      credentialRef: providerConnections.credentialRef,
    })
    .from(providerConnections)
    .innerJoin(installations, eq(installations.id, providerConnections.installationId))
    .innerJoin(users, eq(users.id, installations.userId))
    .where(
      userEmail
        ? and(...conditions, eq(users.email, userEmail))
        : and(...conditions),
    );

  return rows;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

async function upsertIntervalReadings(
  installationId: string,
  slots: IntervalSlot[],
): Promise<{ slotsWritten: number }> {
  if (slots.length === 0) return { slotsWritten: 0 };

  const values = slots.map((s) => ({
    installationId,
    intervalStart: s.intervalStart,
    importKwh: String(s.importKwh),
    generationKwh: String(s.generationKwh),
    exportKwh: String(s.exportKwh),
    immersionDivertedKwh: String(s.immersionDivertedKwh),
    immersionBoostedKwh: String(s.immersionBoostedKwh),
    consumedKwh: String(s.consumedKwh),
    readingCount: s.readingCount,
  }));

  await db
    .insert(intervalReadings)
    .values(values)
    .onConflictDoUpdate({
      target: [intervalReadings.installationId, intervalReadings.intervalStart],
      set: {
        importKwh: sql`excluded.import_kwh`,
        generationKwh: sql`excluded.generation_kwh`,
        exportKwh: sql`excluded.export_kwh`,
        immersionDivertedKwh: sql`excluded.immersion_diverted_kwh`,
        immersionBoostedKwh: sql`excluded.immersion_boosted_kwh`,
        consumedKwh: sql`excluded.consumed_kwh`,
        readingCount: sql`excluded.reading_count`,
      },
    });

  return { slotsWritten: slots.length };
}

// ---------------------------------------------------------------------------
// Per-installation job
// ---------------------------------------------------------------------------

async function summariseInstallation(
  inst: ActiveInstallation,
  targetDate: string,
): Promise<InstallationJobOutcome> {
  const base = { installationId: inst.installationId, timezone: inst.timezone, targetDate };

  const credentials = resolveMyEnergiCredentials(inst.credentialRef);
  if (!credentials) {
    return {
      ...base,
      status: 'failed',
      errorCode: 'missing-credentials',
      errorSummary: 'Could not resolve MyEnergi credentials from credentialRef',
    };
  }

  const fetchResult = await fetchDayRecords(targetDate, inst.timezone, credentials);

  if (!fetchResult.ok) {
    const errorCode =
      fetchResult.kind === 'auth-failure'
        ? 'auth-failure'
        : fetchResult.kind === 'empty-day'
          ? 'empty-day'
          : 'upstream-error';

    return { ...base, status: 'failed', errorCode, errorSummary: fetchResult.detail };
  }

  const readings = normaliseEddiRecords(fetchResult.records, targetDate, inst.timezone);
  const expected = expectedMinutesForDay(targetDate, inst.timezone);
  const slots = aggregateToIntervalReadings(readings, targetDate, inst.timezone);

  await upsertIntervalReadings(inst.installationId, slots);

  const totalReadingCount = slots.reduce((s, slot) => s + slot.readingCount, 0);
  const isPartial = totalReadingCount < expected;

  return {
    ...base,
    status: 'success',
    readingsCount: readings.length,
    isPartial,
  };
}

// ---------------------------------------------------------------------------
// Job-run record helpers
// ---------------------------------------------------------------------------

async function startJobRun(installationId: string, targetDate: string): Promise<string> {
  const [row] = await db
    .insert(jobRuns)
    .values({
      jobType: 'daily-summary',
      installationId,
      status: 'running',
      metadataJson: { targetDate },
    })
    .returning({ id: jobRuns.id });

  return row.id;
}

async function finishJobRun(
  runId: string,
  outcome: InstallationJobOutcome,
): Promise<void> {
  await db
    .update(jobRuns)
    .set({
      status: outcome.status === 'success' ? 'completed' : outcome.status,
      finishedAt: new Date(),
      recordsWritten: outcome.status === 'success' ? (outcome.readingsCount ?? 0) : 0,
      errorSummary: outcome.errorSummary ?? null,
      metadataJson: {
        targetDate: outcome.targetDate,
        readingsCount: outcome.readingsCount,
        isPartial: outcome.isPartial,
        errorCode: outcome.errorCode,
      },
    })
    .where(eq(jobRuns.id, runId));
}

// ---------------------------------------------------------------------------
// Main job entry point
// ---------------------------------------------------------------------------

export type RunDailySummaryJobOptions = {
  /**
   * Override the target date (YYYY-MM-DD) instead of deriving yesterday.
   * Used by local dev scripts and catch-up mode.
   */
  targetDate?: string;

  /**
   * If true, skip the "is it past midnight + buffer?" eligibility check.
   * Used by catch-up and manual invocations where the caller already knows
   * the date is complete.
   */
  skipEligibilityCheck?: boolean;

  /**
   * Clock override for testing.
   */
  now?: Date;
};

/**
 * Run the daily summary job for all active installations.
 */
export async function runDailySummaryJob(
  options: RunDailySummaryJobOptions = {},
): Promise<DailySummaryJobResult> {
  const now = options.now ?? new Date();
  const triggeredAt = now.toISOString();

  const activeInstallations = await loadActiveInstallations();

  const outcomes: InstallationJobOutcome[] = [];

  for (const inst of activeInstallations) {
    const targetDate = options.targetDate ?? getPreviousLocalDate(inst.timezone, now);

    if (!options.skipEligibilityCheck && !isAfterMidnightBuffer(inst.timezone, 15, now)) {
      outcomes.push({
        installationId: inst.installationId,
        timezone: inst.timezone,
        targetDate,
        status: 'skipped',
        errorSummary: 'Not yet past midnight buffer',
      });
      continue;
    }

    const runId = await startJobRun(inst.installationId, targetDate);
    let outcome: InstallationJobOutcome;
    try {
      outcome = await summariseInstallation(inst, targetDate);
    } catch (err) {
      const errorSummary = err instanceof Error ? err.message : String(err);
      outcome = {
        installationId: inst.installationId,
        timezone: inst.timezone,
        targetDate,
        status: 'failed',
        errorCode: 'unexpected-error',
        errorSummary,
      };
    } finally {
      await finishJobRun(runId, outcome!);
    }

    outcomes.push(outcome!);
  }

  return {
    triggeredAt,
    outcomes,
    successCount: outcomes.filter((o) => o.status === 'success').length,
    skippedCount: outcomes.filter((o) => o.status === 'skipped').length,
    failedCount: outcomes.filter((o) => o.status === 'failed').length,
  };
}

// ---------------------------------------------------------------------------
// Catch-up: summarise all missing eligible days for all active installations
// ---------------------------------------------------------------------------

export type RunCatchUpOptions = {
  /**
   * Summarise from this date onwards (inclusive). Defaults to 30 days ago.
   */
  fromDate?: string;

  /**
   * Restrict the catch-up to the installation(s) belonging to this user email.
   * When omitted, all active installations are processed.
   */
  userEmail?: string;

  /**
   * Clock override for testing.
   */
  now?: Date;
};

/**
 * Summarise all missing days from fromDate up to and including yesterday for
 * every active installation. A day is considered complete when interval_readings
 * already contains the expected number of slots for that date.
 */
export async function runCatchUp(options: RunCatchUpOptions = {}): Promise<void> {
  const now = options.now ?? new Date();

  if (options.userEmail) {
    console.log(`[catch-up] Filtering to user: ${options.userEmail}`);
  }

  const activeInstallations = await loadActiveInstallations(options.userEmail);
  if (activeInstallations.length === 0) {
    console.log('[catch-up] No active installations found.');
    return;
  }

  let fromDate = options.fromDate;
  if (!fromDate) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 30);
    fromDate = d.toISOString().slice(0, 10);
  }

  const yesterday = getPreviousLocalDate('Europe/Dublin', now);
  const datesToProcess: string[] = [];
  {
    const cur = new Date(`${fromDate}T00:00:00Z`);
    const end = new Date(`${yesterday}T00:00:00Z`);
    while (cur <= end) {
      datesToProcess.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  if (datesToProcess.length === 0) {
    console.log('[catch-up] No dates to process.');
    return;
  }

  const installationIds = activeInstallations.map((i) => i.installationId);

  // For each (installation, date), check whether interval_readings already
  // has a full set of slots. A full set = expectedMinutesForDay / 30 slots.
  // We query counts per installation per UTC day-window and compare.
  const existingSet = new Set<string>();

  for (const inst of activeInstallations) {
    for (const date of datesToProcess) {
      const expectedMinutes = expectedMinutesForDay(date, inst.timezone);
      const expectedSlots = Math.ceil(expectedMinutes / 30);
      const utcStart = new Date(utcStartOfLocalDate(date, inst.timezone));
      const utcEnd = new Date(utcStart.getTime() + expectedMinutes * 60 * 1000);

      const rows = await db
        .select({ slotCount: count() })
        .from(intervalReadings)
        .where(
          and(
            inArray(intervalReadings.installationId, installationIds),
            eq(intervalReadings.installationId, inst.installationId),
            gte(intervalReadings.intervalStart, utcStart),
            lt(intervalReadings.intervalStart, utcEnd),
          ),
        );

      const slotCount = rows[0]?.slotCount ?? 0;
      if (slotCount >= expectedSlots) {
        existingSet.add(`${inst.installationId}::${date}`);
      }
    }
  }

  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const date of datesToProcess) {
    for (const inst of activeInstallations) {
      const key = `${inst.installationId}::${date}`;
      if (existingSet.has(key)) {
        totalSkipped++;
        continue;
      }

      console.log(`[catch-up] Summarising ${inst.installationId} for ${date}…`);
      const runId = await startJobRun(inst.installationId, date);
      let outcome: InstallationJobOutcome;
      try {
        outcome = await summariseInstallation(inst, date);
      } catch (err) {
        const errorSummary = err instanceof Error ? err.message : String(err);
        outcome = {
          installationId: inst.installationId,
          timezone: inst.timezone,
          targetDate: date,
          status: 'failed',
          errorCode: 'unexpected-error',
          errorSummary,
        };
      } finally {
        await finishJobRun(runId, outcome!);
      }

      if (outcome!.status === 'success') {
        totalSuccess++;
        console.log(
          `[catch-up]   ✓ ${date} — ${outcome!.readingsCount} readings${outcome!.isPartial ? ' (partial)' : ''}`,
        );
      } else if (outcome!.status === 'failed') {
        totalFailed++;
        console.log(`[catch-up]   ✗ ${date} — ${outcome!.errorSummary}`);
      }
    }
  }

  console.log(
    `[catch-up] Done. success=${totalSuccess} skipped=${totalSkipped} failed=${totalFailed}`,
  );
}
