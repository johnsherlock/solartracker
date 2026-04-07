/**
 * Core daily-summary job.
 *
 * runDailySummaryJob() is the single shared implementation called by:
 *   - the Vercel cron entrypoint (POST /api/internal/jobs/daily-summary)
 *   - the local CLI scripts (job:daily-summary, job:catch-up)
 *
 * It queries all active MyEnergi installations, fetches the previous local day
 * from the MyEnergi API, derives persisted daily summary fields, and upserts
 * one daily_summaries row per installation + local date.
 */

import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../db/client';
import {
  installations,
  providerConnections,
  dailySummaries,
  jobRuns,
  tariffPlans,
  tariffPlanVersions,
} from '../db/schema';
import { fetchDayRecords } from '../providers/myenergi/client';
import { normaliseEddiRecords } from '../providers/myenergi/adapter';
import { resolveMyEnergiCredentials } from '../providers/myenergi/credentials';
import {
  getPreviousLocalDate,
  isAfterMidnightBuffer,
  expectedMinutesForDay,
  deriveDailySummaryFields,
  type TariffWindows,
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

async function loadActiveInstallations(): Promise<ActiveInstallation[]> {
  const rows = await db
    .select({
      installationId: installations.id,
      timezone: installations.timezone,
      providerConnectionId: providerConnections.id,
      credentialRef: providerConnections.credentialRef,
    })
    .from(providerConnections)
    .innerJoin(installations, eq(installations.id, providerConnections.installationId))
    .where(
      and(
        eq(providerConnections.providerType, 'myenergi'),
        eq(providerConnections.status, 'active'),
      ),
    );

  return rows;
}

// ---------------------------------------------------------------------------
// Tariff window loader
// ---------------------------------------------------------------------------

async function loadTariffWindowsForDate(
  installationId: string,
  localDate: string,
): Promise<TariffWindows | null> {
  const planRows = await db
    .select({ id: tariffPlans.id })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) return null;

  const planIds = planRows.map((p) => p.id);

  const versionRows = await db
    .select({
      nightStartLocalTime: tariffPlanVersions.nightStartLocalTime,
      nightEndLocalTime: tariffPlanVersions.nightEndLocalTime,
      peakStartLocalTime: tariffPlanVersions.peakStartLocalTime,
      peakEndLocalTime: tariffPlanVersions.peakEndLocalTime,
    })
    .from(tariffPlanVersions)
    .where(
      and(
        planIds.length === 1
          ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
          : inArray(tariffPlanVersions.tariffPlanId, planIds),
        lte(tariffPlanVersions.validFromLocalDate, localDate),
        or(
          isNull(tariffPlanVersions.validToLocalDate),
          gte(tariffPlanVersions.validToLocalDate, localDate),
        ),
      ),
    )
    .orderBy(desc(tariffPlanVersions.validFromLocalDate))
    .limit(1);

  if (versionRows.length === 0) return null;

  const v = versionRows[0];
  if (!v.nightStartLocalTime || !v.nightEndLocalTime) return null;

  return {
    nightStartLocalTime: v.nightStartLocalTime,
    nightEndLocalTime: v.nightEndLocalTime,
    peakStartLocalTime: v.peakStartLocalTime ?? null,
    peakEndLocalTime: v.peakEndLocalTime ?? null,
  };
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

async function upsertDailySummary(
  installationId: string,
  localDate: string,
  fields: ReturnType<typeof deriveDailySummaryFields>,
): Promise<{ written: boolean }> {
  const now = new Date();

  const values = {
    installationId,
    localDate,
    importKwh: String(fields.importKwh),
    exportKwh: String(fields.exportKwh),
    generatedKwh: String(fields.generatedKwh),
    consumedKwh: String(fields.consumedKwh),
    immersionDivertedKwh: String(fields.immersionDivertedKwh),
    immersionBoostedKwh: String(fields.immersionBoostedKwh),
    selfConsumptionRatio:
      fields.selfConsumptionRatio != null ? String(fields.selfConsumptionRatio) : null,
    gridDependenceRatio:
      fields.gridDependenceRatio != null ? String(fields.gridDependenceRatio) : null,
    dayImportKwh: fields.dayImportKwh != null ? String(fields.dayImportKwh) : null,
    nightImportKwh: fields.nightImportKwh != null ? String(fields.nightImportKwh) : null,
    peakImportKwh: fields.peakImportKwh != null ? String(fields.peakImportKwh) : null,
    freeImportKwh: fields.freeImportKwh != null ? String(fields.freeImportKwh) : null,
    isPartial: fields.isPartial,
    rebuiltAt: now,
  };

  await db
    .insert(dailySummaries)
    .values(values)
    .onConflictDoUpdate({
      target: [dailySummaries.installationId, dailySummaries.localDate],
      set: {
        importKwh: values.importKwh,
        exportKwh: values.exportKwh,
        generatedKwh: values.generatedKwh,
        consumedKwh: values.consumedKwh,
        immersionDivertedKwh: values.immersionDivertedKwh,
        immersionBoostedKwh: values.immersionBoostedKwh,
        selfConsumptionRatio: values.selfConsumptionRatio,
        gridDependenceRatio: values.gridDependenceRatio,
        dayImportKwh: values.dayImportKwh,
        nightImportKwh: values.nightImportKwh,
        peakImportKwh: values.peakImportKwh,
        freeImportKwh: values.freeImportKwh,
        isPartial: values.isPartial,
        rebuiltAt: values.rebuiltAt,
      },
    });

  return { written: true };
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
  const tariffWindows = await loadTariffWindowsForDate(inst.installationId, targetDate);
  const fields = deriveDailySummaryFields(readings, expected, tariffWindows);

  await upsertDailySummary(inst.installationId, targetDate, fields);

  return {
    ...base,
    status: 'success',
    readingsCount: readings.length,
    isPartial: fields.isPartial,
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
      recordsWritten: outcome.status === 'success' ? 1 : 0,
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
 *
 * For the Ireland-only beta this is typically triggered by a Vercel cron at
 * 00:15 UTC (safely after local midnight in both GMT and BST). The job
 * still resolves the correct previous local date per installation timezone
 * rather than assuming a fixed UTC offset.
 */
export async function runDailySummaryJob(
  options: RunDailySummaryJobOptions = {},
): Promise<DailySummaryJobResult> {
  const now = options.now ?? new Date();
  const triggeredAt = now.toISOString();

  const activeInstallations = await loadActiveInstallations();

  const outcomes: InstallationJobOutcome[] = [];

  for (const inst of activeInstallations) {
    // Determine the target date for this installation.
    const targetDate = options.targetDate ?? getPreviousLocalDate(inst.timezone, now);

    // Check whether the previous local day is safely finalized (unless the
    // caller has bypassed this check, e.g. for catch-up runs).
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
   * Clock override for testing.
   */
  now?: Date;
};

/**
 * Summarise all missing days from fromDate up to and including yesterday for
 * every active installation. Existing rows are left untouched (skipped).
 *
 * This is the local dev and backfill path. It calls summariseInstallation()
 * directly per (installation, date) pair so each combination is processed
 * exactly once, rather than routing through runDailySummaryJob() which would
 * re-query all installations on every call.
 */
export async function runCatchUp(options: RunCatchUpOptions = {}): Promise<void> {
  const now = options.now ?? new Date();

  const activeInstallations = await loadActiveInstallations();
  if (activeInstallations.length === 0) {
    console.log('[catch-up] No active installations found.');
    return;
  }

  // Default from-date: 30 days ago in UTC.
  let fromDate = options.fromDate;
  if (!fromDate) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 30);
    fromDate = d.toISOString().slice(0, 10);
  }

  // Build a list of all calendar dates from fromDate to yesterday (UTC).
  // Since we assume Ireland-only beta, yesterday UTC is a safe upper bound.
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

  // Load already-summarised (installationId, localDate) pairs to skip.
  const installationIds = activeInstallations.map((i) => i.installationId);
  const existingRows = await db
    .select({
      installationId: dailySummaries.installationId,
      localDate: dailySummaries.localDate,
    })
    .from(dailySummaries)
    .where(
      and(
        inArray(dailySummaries.installationId, installationIds),
        // Filter to dates within our catch-up window only
      ),
    );

  const existingSet = new Set(
    existingRows
      .filter((r) => r.localDate >= fromDate! && r.localDate <= yesterday)
      .map((r) => `${r.installationId}::${r.localDate}`),
  );

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
