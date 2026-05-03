/**
 * Builds and persists daily priced rollups from raw interval readings.
 *
 * The rollup summarises one installation-day into energy totals, coverage
 * metadata, and tariff-priced financial outputs. Once stored, the range API
 * reads from these rows instead of repricing raw interval_readings on every
 * request.
 */

import { sql } from 'drizzle-orm';
import {
  getScheduledRateForInterval,
  fixedChargeContributionForDate,
  resolveTariffVersion,
  type ScheduledTariffVersion,
  type FixedChargeVersion,
} from '../domain/billing';
import { expectedMinutesForDay, isPartialDay, utcStartOfLocalDate } from '../jobs/derive-summary';
import type { IntervalSlot } from '../jobs/derive-summary';

type RollupServiceDbModule = typeof import('../db/client');
type RollupServiceSchemaModule = typeof import('../db/schema');

let _dbDeps:
  | Promise<{
      db: RollupServiceDbModule['db'];
      dailyPricedRollups: RollupServiceSchemaModule['dailyPricedRollups'];
      intervalReadings: RollupServiceSchemaModule['intervalReadings'];
    }>
  | null = null;

async function getDbDeps() {
  if (!_dbDeps) {
    _dbDeps = Promise.all([import('../db/client'), import('../db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        dailyPricedRollups: schema.dailyPricedRollups,
        intervalReadings: schema.intervalReadings,
      }),
    );
  }
  return _dbDeps;
}

// ---------------------------------------------------------------------------
// UTC → local datetime conversion (mirrors billing.ts)
// ---------------------------------------------------------------------------

const localDateTimeFormatter = (timezone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

function utcToLocalDateTime(utc: Date, timezone: string): string {
  const parts = localDateTimeFormatter(timezone).formatToParts(utc);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DailyRollupData = {
  tariffVersionId: string | null;
  generatedKwh: number;
  importKwh: number;
  exportKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
  totalReadingCount: number;
  slotCount: number;
  isPartial: boolean;
  importCost: number | null;
  exportCredit: number | null;
  selfConsumedSolarValue: number | null;
  withoutSolarImportCost: number | null;
  fixedCharges: number | null;
  freeImportKwh: number | null;
};

// ---------------------------------------------------------------------------
// Pure derivation
// ---------------------------------------------------------------------------

/**
 * Derive a DailyRollupData for a single local date from its interval slots.
 *
 * Applies the same per-slot pricing logic used in computeRangeSummary so that
 * reading from the rollup produces identical financial values to reading from
 * raw intervals.
 */
export function buildDailyPricedRollup(
  slots: IntervalSlot[],
  localDate: string,
  timezone: string,
  tariffVersions: ScheduledTariffVersion[],
  fixedCharges: FixedChargeVersion[],
): DailyRollupData {
  let generatedKwh = 0;
  let importKwh = 0;
  let exportKwh = 0;
  let consumedKwh = 0;
  let immersionDivertedKwh = 0;
  let totalReadingCount = 0;

  let actualImportCost = 0;
  let exportCreditAcc = 0;
  let selfConsumedSolarValueAcc = 0;
  let withoutSolarImportCostAcc = 0;
  let freeImportKwhAcc = 0;
  let hasTariffCoverage = false;
  let resolvedTariffVersionId: string | null = null;

  for (const slot of slots) {
    generatedKwh += slot.generationKwh;
    importKwh += slot.importKwh;
    exportKwh += slot.exportKwh;
    consumedKwh += slot.consumedKwh;
    immersionDivertedKwh += slot.immersionDivertedKwh;
    totalReadingCount += slot.readingCount;

    if (tariffVersions.length > 0) {
      try {
        const localDateTime = utcToLocalDateTime(slot.intervalStart, timezone);
        const tariff = resolveTariffVersion(tariffVersions, localDateTime) as ScheduledTariffVersion;
        const vat = 1 + (tariff.vatRate ?? 0);
        const discount =
          tariff.discountRuleType === 'percentage' && tariff.discountValue != null
            ? 1 - tariff.discountValue
            : 1;

        const schedule = tariff.weeklySchedule;
        const periods = tariff.pricePeriods;
        const slotRate =
          schedule && periods.length > 0
            ? getScheduledRateForInterval(periods, schedule, localDateTime)
            : tariff.dayRate;

        if (slotRate === 0 && slot.importKwh > 0) {
          freeImportKwhAcc += slot.importKwh;
        }

        actualImportCost += slot.importKwh * slotRate * discount * vat;

        const selfConsumed = Math.max(
          0,
          slot.generationKwh - slot.exportKwh - slot.immersionDivertedKwh,
        );
        selfConsumedSolarValueAcc += selfConsumed * slotRate * discount * vat;

        exportCreditAcc += slot.exportKwh * (tariff.exportRate ?? 0);

        const withoutSolarImport = Math.max(
          0,
          slot.importKwh + slot.generationKwh - slot.exportKwh - slot.immersionDivertedKwh,
        );
        withoutSolarImportCostAcc += withoutSolarImport * slotRate * discount * vat;

        hasTariffCoverage = true;
        // Use midday tariff resolution as the canonical version for this day
        if (resolvedTariffVersionId === null) {
          resolvedTariffVersionId = tariff.id;
        }
      } catch {
        // No tariff coverage for this slot
      }
    }
  }

  // Resolve canonical tariff version for this day via midday lookup
  if (tariffVersions.length > 0 && resolvedTariffVersionId === null) {
    try {
      const midday = resolveTariffVersion(tariffVersions, `${localDate}T12:00`) as ScheduledTariffVersion;
      resolvedTariffVersionId = midday.id;
    } catch {
      // No tariff coverage for this date
    }
  }

  const expectedMinutes = expectedMinutesForDay(localDate, timezone);
  const partial = isPartialDay(totalReadingCount, expectedMinutes);

  let dayFixedCharges: number | null = null;
  if (hasTariffCoverage && resolvedTariffVersionId !== null) {
    dayFixedCharges = fixedChargeContributionForDate(localDate, resolvedTariffVersionId, fixedCharges);
  }

  return {
    tariffVersionId: resolvedTariffVersionId,
    generatedKwh: r6(generatedKwh),
    importKwh: r6(importKwh),
    exportKwh: r6(exportKwh),
    consumedKwh: r6(consumedKwh),
    immersionDivertedKwh: r6(immersionDivertedKwh),
    totalReadingCount,
    slotCount: slots.length,
    isPartial: partial,
    importCost: hasTariffCoverage ? r2(actualImportCost) : null,
    exportCredit: hasTariffCoverage ? r2(exportCreditAcc) : null,
    selfConsumedSolarValue: hasTariffCoverage ? r2(selfConsumedSolarValueAcc) : null,
    withoutSolarImportCost: hasTariffCoverage ? r2(withoutSolarImportCostAcc) : null,
    fixedCharges: dayFixedCharges,
    freeImportKwh: hasTariffCoverage ? r6(freeImportKwhAcc) : null,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Upsert a daily priced rollup row, replacing all fields on conflict.
 */
export async function upsertDailyPricedRollup(
  installationId: string,
  localDate: string,
  data: DailyRollupData,
): Promise<void> {
  const { db, dailyPricedRollups } = await getDbDeps();

  const value = {
    installationId,
    localDate,
    tariffVersionId: data.tariffVersionId,
    generatedKwh: String(data.generatedKwh),
    importKwh: String(data.importKwh),
    exportKwh: String(data.exportKwh),
    consumedKwh: String(data.consumedKwh),
    immersionDivertedKwh: String(data.immersionDivertedKwh),
    totalReadingCount: data.totalReadingCount,
    slotCount: data.slotCount,
    isPartial: data.isPartial,
    importCost: data.importCost != null ? String(data.importCost) : null,
    exportCredit: data.exportCredit != null ? String(data.exportCredit) : null,
    selfConsumedSolarValue:
      data.selfConsumedSolarValue != null ? String(data.selfConsumedSolarValue) : null,
    withoutSolarImportCost:
      data.withoutSolarImportCost != null ? String(data.withoutSolarImportCost) : null,
    fixedCharges: data.fixedCharges != null ? String(data.fixedCharges) : null,
    freeImportKwh: data.freeImportKwh != null ? String(data.freeImportKwh) : null,
  };

  await db
    .insert(dailyPricedRollups)
    .values(value)
    .onConflictDoUpdate({
      target: [dailyPricedRollups.installationId, dailyPricedRollups.localDate],
      set: {
        tariffVersionId: sql`excluded.tariff_version_id`,
        generatedKwh: sql`excluded.generated_kwh`,
        importKwh: sql`excluded.import_kwh`,
        exportKwh: sql`excluded.export_kwh`,
        consumedKwh: sql`excluded.consumed_kwh`,
        immersionDivertedKwh: sql`excluded.immersion_diverted_kwh`,
        totalReadingCount: sql`excluded.total_reading_count`,
        slotCount: sql`excluded.slot_count`,
        isPartial: sql`excluded.is_partial`,
        importCost: sql`excluded.import_cost`,
        exportCredit: sql`excluded.export_credit`,
        selfConsumedSolarValue: sql`excluded.self_consumed_solar_value`,
        withoutSolarImportCost: sql`excluded.without_solar_import_cost`,
        fixedCharges: sql`excluded.fixed_charges`,
        freeImportKwh: sql`excluded.free_import_kwh`,
        updatedAt: sql`now()`,
      },
    });
}

// ---------------------------------------------------------------------------
// Load-and-persist helper (for catch-up and standalone use)
// ---------------------------------------------------------------------------

/**
 * Load interval readings and tariff context from the DB for a single
 * (installationId, localDate), derive the rollup, and upsert it.
 *
 * Used by the catch-up job for historical backfill and by any path that needs
 * to rebuild a rollup without the interval slots already in memory.
 */
export async function buildAndPersistRollupForDate(
  installationId: string,
  localDate: string,
  timezone: string,
): Promise<void> {
  // Lazy-import to keep this module usable in both job and API contexts
  const [
    { loadTariffVersionsForInstallation, loadFixedChargeVersionsForInstallation },
    { db, intervalReadings },
  ] = await Promise.all([
    import('./loader'),
    getDbDeps(),
  ]);

  const { and, eq, gte, lt, asc } = await import('drizzle-orm');

  const utcFrom = new Date(utcStartOfLocalDate(localDate, timezone));
  const expectedMinutes = expectedMinutesForDay(localDate, timezone);
  const utcTo = new Date(utcFrom.getTime() + expectedMinutes * 60 * 1000);

  const [rawSlots, tariffVersions, fixedCharges] = await Promise.all([
    db
      .select()
      .from(intervalReadings)
      .where(
        and(
          eq(intervalReadings.installationId, installationId),
          gte(intervalReadings.intervalStart, utcFrom),
          lt(intervalReadings.intervalStart, utcTo),
        ),
      )
      .orderBy(asc(intervalReadings.intervalStart)),
    loadTariffVersionsForInstallation(installationId),
    loadFixedChargeVersionsForInstallation(installationId),
  ]);

  if (rawSlots.length === 0) return;

  const slots: IntervalSlot[] = rawSlots.map((r) => ({
    intervalStart: r.intervalStart,
    importKwh: Number(r.importKwh),
    generationKwh: Number(r.generationKwh),
    exportKwh: Number(r.exportKwh),
    immersionDivertedKwh: Number(r.immersionDivertedKwh),
    immersionBoostedKwh: Number(r.immersionBoostedKwh),
    consumedKwh: Number(r.consumedKwh),
    readingCount: r.readingCount,
  }));

  const data = buildDailyPricedRollup(slots, localDate, timezone, tariffVersions, fixedCharges);
  await upsertDailyPricedRollup(installationId, localDate, data);
}
