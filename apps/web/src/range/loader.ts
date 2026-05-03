/**
 * DB loaders for the range-summary API.
 *
 * All queries are scoped to an installation. The caller is responsible for
 * resolving the correct installationId before calling these functions.
 */

import { and, asc, eq, gte, inArray, lt, lte, min } from 'drizzle-orm';
import type { TariffPricePeriod, ScheduledTariffVersion, FixedChargeVersion } from '../domain/billing';
import { utcStartOfLocalDate } from '../jobs/derive-summary';
import type { DailyRollupData } from './rollup-service';

type RangeLoaderDbModule = typeof import('../db/client');
type RangeLoaderSchemaModule = typeof import('../db/schema');

let _dbDeps:
  | Promise<{
      db: RangeLoaderDbModule['db'];
      installations: RangeLoaderSchemaModule['installations'];
      tariffPlans: RangeLoaderSchemaModule['tariffPlans'];
      tariffPlanVersions: RangeLoaderSchemaModule['tariffPlanVersions'];
      tariffPricePeriods: RangeLoaderSchemaModule['tariffPricePeriods'];
      tariffFixedChargeVersions: RangeLoaderSchemaModule['tariffFixedChargeVersions'];
      intervalReadings: RangeLoaderSchemaModule['intervalReadings'];
      dailyPricedRollups: RangeLoaderSchemaModule['dailyPricedRollups'];
      systemAdditions: RangeLoaderSchemaModule['systemAdditions'];
    }>
  | null = null;

async function getDbDeps() {
  if (!_dbDeps) {
    _dbDeps = Promise.all([import('../db/client'), import('../db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        installations: schema.installations,
        tariffPlans: schema.tariffPlans,
        tariffPlanVersions: schema.tariffPlanVersions,
        tariffPricePeriods: schema.tariffPricePeriods,
        tariffFixedChargeVersions: schema.tariffFixedChargeVersions,
        intervalReadings: schema.intervalReadings,
        dailyPricedRollups: schema.dailyPricedRollups,
        systemAdditions: schema.systemAdditions,
      }),
    );
  }
  return _dbDeps;
}

export type RepaymentScheduleEntry = {
  additionDate: string;
  monthlyRepayment: number;
  repaymentDurationMonths: number;
};

export type RangeInstallationContext = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  /** Sum of all system addition investment totals (upfront + monthly × duration), or null when no additions recorded. */
  totalSystemInvestment: number | null;
  /** ISO date of the earliest system addition, or null when no additions recorded. */
  earliestAdditionDate: string | null;
  /** Raw repayment schedules for period-aware coverage calculation. Empty when no financed additions. */
  repaymentSchedules: RepaymentScheduleEntry[];
};

export async function loadRangeInstallationContext(
  installationId: string,
): Promise<RangeInstallationContext | null> {
  const { db, installations, systemAdditions } = await getDbDeps();

  const [installationRows, additionRows] = await Promise.all([
    db.select().from(installations).where(eq(installations.id, installationId)).limit(1),
    db
      .select({
        additionDate: systemAdditions.additionDate,
        upfrontPayment: systemAdditions.upfrontPayment,
        monthlyRepayment: systemAdditions.monthlyRepayment,
        repaymentDurationMonths: systemAdditions.repaymentDurationMonths,
      })
      .from(systemAdditions)
      .where(eq(systemAdditions.installationId, installationId)),
  ]);

  if (installationRows.length === 0) return null;
  const row = installationRows[0];

  let totalInvestment = 0;
  let earliestAdditionDate: string | null = null;
  const repaymentSchedules: RepaymentScheduleEntry[] = [];

  for (const a of additionRows) {
    if (earliestAdditionDate === null || a.additionDate < earliestAdditionDate) {
      earliestAdditionDate = a.additionDate;
    }

    const upfront = a.upfrontPayment != null ? Number(a.upfrontPayment) : 0;
    const monthly = a.monthlyRepayment != null ? Number(a.monthlyRepayment) : 0;
    const duration = a.repaymentDurationMonths ?? 0;
    totalInvestment += upfront + monthly * duration;

    if (monthly > 0 && a.repaymentDurationMonths != null) {
      repaymentSchedules.push({
        additionDate: a.additionDate,
        monthlyRepayment: monthly,
        repaymentDurationMonths: a.repaymentDurationMonths,
      });
    }
  }

  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    currency: row.currencyCode,
    totalSystemInvestment: additionRows.length > 0 ? Math.round(totalInvestment * 100) / 100 : null,
    earliestAdditionDate,
    repaymentSchedules,
  };
}

/**
 * Load all tariff plan versions for the installation (all time, not range-filtered).
 * Range filtering is done in domain logic to support tariff-change detection.
 */
export async function loadTariffVersionsForInstallation(
  installationId: string,
): Promise<ScheduledTariffVersion[]> {
  const { db, tariffPlans, tariffPlanVersions, tariffPricePeriods } = await getDbDeps();

  const planRows = await db
    .select({ id: tariffPlans.id })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) return [];

  const planIds = planRows.map((p) => p.id);

  const versionRows = await db
    .select()
    .from(tariffPlanVersions)
    .where(
      planIds.length === 1
        ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
        : inArray(tariffPlanVersions.tariffPlanId, planIds),
    );

  if (versionRows.length === 0) return [];

  const versionIds = versionRows.map((v) => v.id);
  const periodRows = await db
    .select()
    .from(tariffPricePeriods)
    .where(
      versionIds.length === 1
        ? eq(tariffPricePeriods.tariffPlanVersionId, versionIds[0])
        : inArray(tariffPricePeriods.tariffPlanVersionId, versionIds),
    )
    .orderBy(tariffPricePeriods.sortOrder);

  const periodsByVersionId = new Map<string, TariffPricePeriod[]>();
  for (const p of periodRows) {
    const list = periodsByVersionId.get(p.tariffPlanVersionId) ?? [];
    list.push({
      id: p.id,
      tariffPlanVersionId: p.tariffPlanVersionId,
      periodLabel: p.periodLabel,
      ratePerKwh: Number(p.ratePerKwh),
      isFreeImport: p.isFreeImport,
      sortOrder: p.sortOrder,
    });
    periodsByVersionId.set(p.tariffPlanVersionId, list);
  }

  return versionRows.map((v) => ({
    id: v.id,
    validFromLocalDate: v.validFromLocalDate,
    validToLocalDate: v.validToLocalDate ?? null,
    dayRate: Number(v.dayRate),
    nightRate: v.nightRate != null ? Number(v.nightRate) : null,
    peakRate: v.peakRate != null ? Number(v.peakRate) : null,
    exportRate: v.exportRate != null ? Number(v.exportRate) : null,
    vatRate: v.vatRate != null ? Number(v.vatRate) : null,
    discountRuleType: v.discountRuleType === 'percentage' ? 'percentage' : null,
    discountValue: v.discountValue != null ? Number(v.discountValue) : null,
    nightStartLocalTime: v.nightStartLocalTime ?? null,
    nightEndLocalTime: v.nightEndLocalTime ?? null,
    peakStartLocalTime: v.peakStartLocalTime ?? null,
    peakEndLocalTime: v.peakEndLocalTime ?? null,
    pricePeriods: periodsByVersionId.get(v.id) ?? [],
    weeklySchedule: v.weeklyScheduleJson as string[] | null,
  }));
}

/**
 * Load all fixed charge versions for the installation.
 */
export async function loadFixedChargeVersionsForInstallation(
  installationId: string,
): Promise<FixedChargeVersion[]> {
  const { db, tariffPlans, tariffPlanVersions, tariffFixedChargeVersions } = await getDbDeps();

  const planRows = await db
    .select({ id: tariffPlans.id })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) return [];

  const planIds = planRows.map((p) => p.id);

  const versionRows = await db
    .select({ id: tariffPlanVersions.id })
    .from(tariffPlanVersions)
    .where(
      planIds.length === 1
        ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
        : inArray(tariffPlanVersions.tariffPlanId, planIds),
    );

  if (versionRows.length === 0) return [];

  const versionIds = versionRows.map((v) => v.id);

  const rows = await db
    .select()
    .from(tariffFixedChargeVersions)
    .where(
      versionIds.length === 1
        ? eq(tariffFixedChargeVersions.tariffPlanVersionId, versionIds[0])
        : inArray(tariffFixedChargeVersions.tariffPlanVersionId, versionIds),
    );

  return rows
    .filter((r): r is typeof r & { unit: 'per_day' | 'per_month' | 'per_bill' } =>
      r.unit === 'per_day' || r.unit === 'per_month' || r.unit === 'per_bill',
    )
    .map((r) => ({
      id: r.id,
      tariffPlanVersionId: r.tariffPlanVersionId,
      chargeType: r.chargeType,
      amount: Number(r.amount),
      unit: r.unit,
      validFromLocalDate: r.validFromLocalDate,
      validToLocalDate: r.validToLocalDate ?? null,
    }));
}

export type IntervalRow = {
  intervalStart: Date;
  importKwh: number;
  generationKwh: number;
  exportKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  consumedKwh: number;
  readingCount: number;
};

/**
 * Returns the earliest interval_start stored in interval_readings for the
 * installation, expressed as a local date string (YYYY-MM-DD) in the
 * installation's timezone. Returns null when no data exists yet.
 */
export async function loadEarliestIntervalDate(
  installationId: string,
  _timezone: string,
): Promise<string | null> {
  const { db, dailyPricedRollups } = await getDbDeps();
  const rows = await db
    .select({ earliest: min(dailyPricedRollups.localDate) })
    .from(dailyPricedRollups)
    .where(eq(dailyPricedRollups.installationId, installationId));

  return rows[0]?.earliest ?? null;
}

/**
 * Load persisted interval readings for an installation within an inclusive
 * local date range, ordered by interval_start ascending.
 *
 * The from/to bounds are converted to UTC using the installation timezone so
 * the query correctly spans the full local days (including DST transitions).
 */
export async function loadIntervalReadingsForRange(
  installationId: string,
  from: string,
  to: string,
  timezone: string,
): Promise<IntervalRow[]> {
  const { db, intervalReadings } = await getDbDeps();

  // Compute the UTC bounds: start of the `from` local date, up to (but not
  // including) the start of the day after `to`.
  const utcFrom = new Date(utcStartOfLocalDate(from, timezone));
  const toPlusOne = new Date(`${to}T00:00:00Z`);
  toPlusOne.setUTCDate(toPlusOne.getUTCDate() + 1);
  const utcTo = new Date(utcStartOfLocalDate(toPlusOne.toISOString().slice(0, 10), timezone));

  const rows = await db
    .select()
    .from(intervalReadings)
    .where(
      and(
        eq(intervalReadings.installationId, installationId),
        gte(intervalReadings.intervalStart, utcFrom),
        lt(intervalReadings.intervalStart, utcTo),
      ),
    )
    .orderBy(asc(intervalReadings.intervalStart));

  return rows.map((r) => ({
    intervalStart: r.intervalStart,
    importKwh: Number(r.importKwh),
    generationKwh: Number(r.generationKwh),
    exportKwh: Number(r.exportKwh),
    immersionDivertedKwh: Number(r.immersionDivertedKwh),
    immersionBoostedKwh: Number(r.immersionBoostedKwh),
    consumedKwh: Number(r.consumedKwh),
    readingCount: r.readingCount,
  }));
}

// ---------------------------------------------------------------------------
// Daily priced rollup loader
// ---------------------------------------------------------------------------

export type DailyPricedRollupRow = DailyRollupData & { localDate: string };

/**
 * Load persisted daily priced rollups for an installation within an inclusive
 * local date range. Returns one row per covered date; dates without a rollup
 * row are absent from the result.
 */
export async function loadDailyPricedRollupsForRange(
  installationId: string,
  from: string,
  to: string,
): Promise<DailyPricedRollupRow[]> {
  const { db, dailyPricedRollups } = await getDbDeps();

  const rows = await db
    .select()
    .from(dailyPricedRollups)
    .where(
      and(
        eq(dailyPricedRollups.installationId, installationId),
        gte(dailyPricedRollups.localDate, from),
        lte(dailyPricedRollups.localDate, to),
      ),
    )
    .orderBy(asc(dailyPricedRollups.localDate));

  return rows.map((r) => ({
    localDate: r.localDate,
    tariffVersionId: r.tariffVersionId ?? null,
    generatedKwh: Number(r.generatedKwh),
    importKwh: Number(r.importKwh),
    exportKwh: Number(r.exportKwh),
    consumedKwh: Number(r.consumedKwh),
    immersionDivertedKwh: Number(r.immersionDivertedKwh),
    totalReadingCount: r.totalReadingCount,
    slotCount: r.slotCount,
    isPartial: r.isPartial,
    importCost: r.importCost != null ? Number(r.importCost) : null,
    exportCredit: r.exportCredit != null ? Number(r.exportCredit) : null,
    selfConsumedSolarValue: r.selfConsumedSolarValue != null ? Number(r.selfConsumedSolarValue) : null,
    withoutSolarImportCost: r.withoutSolarImportCost != null ? Number(r.withoutSolarImportCost) : null,
    fixedCharges: r.fixedCharges != null ? Number(r.fixedCharges) : null,
    freeImportKwh: r.freeImportKwh != null ? Number(r.freeImportKwh) : null,
  }));
}
