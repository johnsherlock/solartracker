import { and, asc, desc, eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricePeriod = {
  id: string;
  periodLabel: string;
  ratePerKwh: string;
  isFreeImport: boolean;
  sortOrder: number;
  colourHex: string | null;
};

export type FixedCharge = {
  id: string;
  chargeType: string;
  amount: string;
  unit: string;
  vatInclusive: boolean;
  validFromLocalDate: string;
  validToLocalDate: string | null;
};

export type TariffVersionDetail = {
  id: string;
  versionLabel: string;
  validFromLocalDate: string;
  validToLocalDate: string | null;
  isActiveDefault: boolean;
  // Schedule-based model
  weeklyScheduleJson: string[] | null;
  pricePeriods: PricePeriod[];
  // Legacy window fields (fallback display when no weeklyScheduleJson)
  dayRate: string | null;
  nightRate: string | null;
  peakRate: string | null;
  exportRate: string | null;
  vatRate: string | null;
  nightStartLocalTime: string | null;
  nightEndLocalTime: string | null;
  peakStartLocalTime: string | null;
  peakEndLocalTime: string | null;
  fixedCharges: FixedCharge[];
};

export type TariffVersionSummary = {
  id: string;
  versionLabel: string;
  validFromLocalDate: string;
  validToLocalDate: string | null;
  isActiveDefault: boolean;
  dayRate: string | null;
  nightRate: string | null;
  peakRate: string | null;
  exportRate: string | null;
};

export type ContractInfo = {
  id: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  expectedReviewDate: string | null;
  postContractDefaultBehavior: string | null;
  notes: string | null;
};

export type TariffPlanInfo = {
  id: string;
  supplierName: string;
  planName: string;
  productCode: string | null;
  isExportEnabled: boolean;
};

export type TariffOverviewData = {
  plan: TariffPlanInfo | null;
  activeVersion: TariffVersionDetail | null;
  allVersions: TariffVersionSummary[];
  contract: ContractInfo | null;
};

// ---------------------------------------------------------------------------
// Lazy DB deps
// ---------------------------------------------------------------------------

type DbModule = typeof import('../db/client');
type SchemaModule = typeof import('../db/schema');

let _deps: Promise<{
  db: DbModule['db'];
  tariffPlans: SchemaModule['tariffPlans'];
  tariffPlanVersions: SchemaModule['tariffPlanVersions'];
  tariffPricePeriods: SchemaModule['tariffPricePeriods'];
  tariffFixedChargeVersions: SchemaModule['tariffFixedChargeVersions'];
  installationContracts: SchemaModule['installationContracts'];
}> | null = null;

async function getDeps() {
  if (!_deps) {
    _deps = Promise.all([import('../db/client'), import('../db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        tariffPlans: schema.tariffPlans,
        tariffPlanVersions: schema.tariffPlanVersions,
        tariffPricePeriods: schema.tariffPricePeriods,
        tariffFixedChargeVersions: schema.tariffFixedChargeVersions,
        installationContracts: schema.installationContracts,
      }),
    );
  }
  return _deps;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadTariffOverview(installationId: string): Promise<TariffOverviewData> {
  const {
    db,
    tariffPlans,
    tariffPlanVersions,
    tariffPricePeriods,
    tariffFixedChargeVersions,
    installationContracts,
  } = await getDeps();

  // Fetch the tariff plan for this installation (one plan per installation for now)
  const plan = await db
    .select({
      id: tariffPlans.id,
      supplierName: tariffPlans.supplierName,
      planName: tariffPlans.planName,
      productCode: tariffPlans.productCode,
      isExportEnabled: tariffPlans.isExportEnabled,
    })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!plan) {
    return { plan: null, activeVersion: null, allVersions: [], contract: null };
  }

  // Fetch all versions ordered newest first
  const versions = await db
    .select({
      id: tariffPlanVersions.id,
      versionLabel: tariffPlanVersions.versionLabel,
      validFromLocalDate: tariffPlanVersions.validFromLocalDate,
      validToLocalDate: tariffPlanVersions.validToLocalDate,
      isActiveDefault: tariffPlanVersions.isActiveDefault,
      weeklyScheduleJson: tariffPlanVersions.weeklyScheduleJson,
      dayRate: tariffPlanVersions.dayRate,
      nightRate: tariffPlanVersions.nightRate,
      peakRate: tariffPlanVersions.peakRate,
      exportRate: tariffPlanVersions.exportRate,
      vatRate: tariffPlanVersions.vatRate,
      nightStartLocalTime: tariffPlanVersions.nightStartLocalTime,
      nightEndLocalTime: tariffPlanVersions.nightEndLocalTime,
      peakStartLocalTime: tariffPlanVersions.peakStartLocalTime,
      peakEndLocalTime: tariffPlanVersions.peakEndLocalTime,
    })
    .from(tariffPlanVersions)
    .where(eq(tariffPlanVersions.tariffPlanId, plan.id))
    .orderBy(desc(tariffPlanVersions.validFromLocalDate));

  const activeVersionRow =
    versions.find((v) => v.isActiveDefault) ??
    versions.find((v) => v.validToLocalDate === null) ??
    versions[0] ??
    null;

  let activeVersion: TariffVersionDetail | null = null;

  if (activeVersionRow) {
    const [pricePeriods, fixedCharges] = await Promise.all([
      db
        .select({
          id: tariffPricePeriods.id,
          periodLabel: tariffPricePeriods.periodLabel,
          ratePerKwh: tariffPricePeriods.ratePerKwh,
          isFreeImport: tariffPricePeriods.isFreeImport,
          sortOrder: tariffPricePeriods.sortOrder,
          colourHex: tariffPricePeriods.colourHex,
        })
        .from(tariffPricePeriods)
        .where(eq(tariffPricePeriods.tariffPlanVersionId, activeVersionRow.id))
        .orderBy(asc(tariffPricePeriods.sortOrder)),

      db
        .select({
          id: tariffFixedChargeVersions.id,
          chargeType: tariffFixedChargeVersions.chargeType,
          amount: tariffFixedChargeVersions.amount,
          unit: tariffFixedChargeVersions.unit,
          vatInclusive: tariffFixedChargeVersions.vatInclusive,
          validFromLocalDate: tariffFixedChargeVersions.validFromLocalDate,
          validToLocalDate: tariffFixedChargeVersions.validToLocalDate,
        })
        .from(tariffFixedChargeVersions)
        .where(eq(tariffFixedChargeVersions.tariffPlanVersionId, activeVersionRow.id))
        .orderBy(asc(tariffFixedChargeVersions.validFromLocalDate)),
    ]);

    activeVersion = {
      ...activeVersionRow,
      weeklyScheduleJson: activeVersionRow.weeklyScheduleJson as string[] | null,
      pricePeriods,
      fixedCharges,
    };
  }

  const allVersions: TariffVersionSummary[] = versions.map((v) => ({
    id: v.id,
    versionLabel: v.versionLabel,
    validFromLocalDate: v.validFromLocalDate,
    validToLocalDate: v.validToLocalDate,
    isActiveDefault: v.isActiveDefault,
    dayRate: v.dayRate,
    nightRate: v.nightRate,
    peakRate: v.peakRate,
    exportRate: v.exportRate,
  }));

  const contract = await db
    .select({
      id: installationContracts.id,
      contractStartDate: installationContracts.contractStartDate,
      contractEndDate: installationContracts.contractEndDate,
      expectedReviewDate: installationContracts.expectedReviewDate,
      postContractDefaultBehavior: installationContracts.postContractDefaultBehavior,
      notes: installationContracts.notes,
    })
    .from(installationContracts)
    .where(
      and(
        eq(installationContracts.installationId, installationId),
        eq(installationContracts.tariffPlanId, plan.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return { plan, activeVersion, allVersions, contract };
}
