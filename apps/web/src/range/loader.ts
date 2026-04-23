/**
 * DB loaders for the range-summary API.
 *
 * All queries are scoped to an installation. The caller is responsible for
 * resolving the correct installationId before calling these functions.
 */

import { and, between, eq, inArray, min } from 'drizzle-orm';
import type { TariffPricePeriod, ScheduledTariffVersion, FixedChargeVersion } from '../domain/billing';

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
      dailySummaries: RangeLoaderSchemaModule['dailySummaries'];
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
        dailySummaries: schema.dailySummaries,
      }),
    );
  }
  return _dbDeps;
}

export type RangeInstallationContext = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  financeMode: string | null;
  monthlyFinancePaymentAmount: number | null;
  financeTermMonths: number | null;
};

export async function loadRangeInstallationContext(
  installationId: string,
): Promise<RangeInstallationContext | null> {
  const { db, installations } = await getDbDeps();
  const rows = await db
    .select()
    .from(installations)
    .where(eq(installations.id, installationId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    currency: row.currencyCode,
    financeMode: row.financeMode,
    monthlyFinancePaymentAmount: row.monthlyFinancePaymentAmount != null ? Number(row.monthlyFinancePaymentAmount) : null,
    financeTermMonths: row.financeTermMonths,
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

export type DailySummaryRow = {
  localDate: string;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number | null;
  immersionDivertedKwh: number | null;
  immersionBoostedKwh: number | null;
  isPartial: boolean;
  dayImportKwh: number | null;
  nightImportKwh: number | null;
  peakImportKwh: number | null;
  freeImportKwh: number | null;
  bandBreakdown: Record<string, number> | null;
};

/**
 * Returns the earliest local_date stored in daily_summaries for the installation,
 * or null when no summaries exist yet.
 */
export async function loadEarliestSummaryDate(
  installationId: string,
): Promise<string | null> {
  const { db, dailySummaries } = await getDbDeps();
  const rows = await db
    .select({ earliest: min(dailySummaries.localDate) })
    .from(dailySummaries)
    .where(eq(dailySummaries.installationId, installationId));
  return rows[0]?.earliest ?? null;
}

/**
 * Load persisted daily summaries for an installation within an inclusive local date range.
 */
export async function loadDailySummaryRowsForRange(
  installationId: string,
  from: string,
  to: string,
): Promise<DailySummaryRow[]> {
  const { db, dailySummaries } = await getDbDeps();

  const rows = await db
    .select()
    .from(dailySummaries)
    .where(
      and(
        eq(dailySummaries.installationId, installationId),
        between(dailySummaries.localDate, from, to),
      ),
    );

  return rows.map((r) => ({
    localDate: r.localDate,
    importKwh: Number(r.importKwh),
    exportKwh: Number(r.exportKwh),
    generatedKwh: Number(r.generatedKwh),
    consumedKwh: r.consumedKwh != null ? Number(r.consumedKwh) : null,
    immersionDivertedKwh: r.immersionDivertedKwh != null ? Number(r.immersionDivertedKwh) : null,
    immersionBoostedKwh: r.immersionBoostedKwh != null ? Number(r.immersionBoostedKwh) : null,
    isPartial: r.isPartial,
    dayImportKwh: r.dayImportKwh != null ? Number(r.dayImportKwh) : null,
    nightImportKwh: r.nightImportKwh != null ? Number(r.nightImportKwh) : null,
    peakImportKwh: r.peakImportKwh != null ? Number(r.peakImportKwh) : null,
    freeImportKwh: r.freeImportKwh != null ? Number(r.freeImportKwh) : null,
    bandBreakdown: r.bandBreakdownJson as Record<string, number> | null,
  }));
}
