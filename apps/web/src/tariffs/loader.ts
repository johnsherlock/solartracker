import { and, asc, desc, eq, inArray } from 'drizzle-orm';

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
  supplierName: string;
  planName: string;
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
  /** All versions across all plans, newest first, including the active one. */
  allVersions: TariffVersionDetail[];
  contract: ContractInfo | null;
};

export type TariffVersionEditData = {
  plan: TariffPlanInfo;
  version: TariffVersionDetail;
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

  // Fetch all tariff plans for this installation — users may end up with more
  // than one if they added versions under different supplier/plan names.
  const planRows = await db
    .select({
      id: tariffPlans.id,
      supplierName: tariffPlans.supplierName,
      planName: tariffPlans.planName,
      productCode: tariffPlans.productCode,
      isExportEnabled: tariffPlans.isExportEnabled,
    })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) {
    return { plan: null, activeVersion: null, allVersions: [], contract: null };
  }

  const planMap = new Map(planRows.map((p) => [p.id, p]));
  const planIds = planRows.map((p) => p.id);

  // Fetch all versions across all plans, newest first
  const versions = await db
    .select({
      id: tariffPlanVersions.id,
      tariffPlanId: tariffPlanVersions.tariffPlanId,
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
    .where(
      planIds.length === 1
        ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
        : inArray(tariffPlanVersions.tariffPlanId, planIds),
    )
    .orderBy(desc(tariffPlanVersions.validFromLocalDate));

  const activeVersionRow =
    versions.find((v) => v.isActiveDefault) ??
    versions.find((v) => v.validToLocalDate === null) ??
    versions[0] ??
    null;

  // Resolve the plan for the active version; fall back to the first plan if needed.
  const plan = activeVersionRow
    ? (planMap.get(activeVersionRow.tariffPlanId) ?? planRows[0])
    : planRows[0];

  // Batch-load price periods and fixed charges for all versions in two queries.
  const versionIds = versions.map((v) => v.id);
  const [allPeriods, allCharges] = versions.length === 0
    ? [[], []]
    : await Promise.all([
        db
          .select({
            tariffPlanVersionId: tariffPricePeriods.tariffPlanVersionId,
            id: tariffPricePeriods.id,
            periodLabel: tariffPricePeriods.periodLabel,
            ratePerKwh: tariffPricePeriods.ratePerKwh,
            isFreeImport: tariffPricePeriods.isFreeImport,
            sortOrder: tariffPricePeriods.sortOrder,
            colourHex: tariffPricePeriods.colourHex,
          })
          .from(tariffPricePeriods)
          .where(
            versionIds.length === 1
              ? eq(tariffPricePeriods.tariffPlanVersionId, versionIds[0])
              : inArray(tariffPricePeriods.tariffPlanVersionId, versionIds),
          )
          .orderBy(asc(tariffPricePeriods.sortOrder)),

        db
          .select({
            tariffPlanVersionId: tariffFixedChargeVersions.tariffPlanVersionId,
            id: tariffFixedChargeVersions.id,
            chargeType: tariffFixedChargeVersions.chargeType,
            amount: tariffFixedChargeVersions.amount,
            unit: tariffFixedChargeVersions.unit,
            vatInclusive: tariffFixedChargeVersions.vatInclusive,
            validFromLocalDate: tariffFixedChargeVersions.validFromLocalDate,
            validToLocalDate: tariffFixedChargeVersions.validToLocalDate,
          })
          .from(tariffFixedChargeVersions)
          .where(
            versionIds.length === 1
              ? eq(tariffFixedChargeVersions.tariffPlanVersionId, versionIds[0])
              : inArray(tariffFixedChargeVersions.tariffPlanVersionId, versionIds),
          )
          .orderBy(asc(tariffFixedChargeVersions.validFromLocalDate)),
      ]);

  // Group by version ID
  const periodsByVersion = new Map<string, PricePeriod[]>();
  for (const p of allPeriods) {
    const arr = periodsByVersion.get(p.tariffPlanVersionId) ?? [];
    arr.push({ id: p.id, periodLabel: p.periodLabel, ratePerKwh: p.ratePerKwh, isFreeImport: p.isFreeImport, sortOrder: p.sortOrder, colourHex: p.colourHex });
    periodsByVersion.set(p.tariffPlanVersionId, arr);
  }
  const chargesByVersion = new Map<string, FixedCharge[]>();
  for (const c of allCharges) {
    const arr = chargesByVersion.get(c.tariffPlanVersionId) ?? [];
    arr.push({ id: c.id, chargeType: c.chargeType, amount: c.amount, unit: c.unit, vatInclusive: c.vatInclusive, validFromLocalDate: c.validFromLocalDate, validToLocalDate: c.validToLocalDate });
    chargesByVersion.set(c.tariffPlanVersionId, arr);
  }

  // Build full TariffVersionDetail for every version
  const allVersions: TariffVersionDetail[] = versions.map((v) => {
    const vPlan = planMap.get(v.tariffPlanId) ?? planRows[0];
    return {
      id: v.id,
      versionLabel: v.versionLabel,
      validFromLocalDate: v.validFromLocalDate,
      validToLocalDate: v.validToLocalDate,
      isActiveDefault: v.isActiveDefault,
      supplierName: vPlan.supplierName,
      planName: vPlan.planName,
      weeklyScheduleJson: v.weeklyScheduleJson as string[] | null,
      pricePeriods: periodsByVersion.get(v.id) ?? [],
      dayRate: v.dayRate,
      nightRate: v.nightRate,
      peakRate: v.peakRate,
      exportRate: v.exportRate,
      vatRate: v.vatRate,
      nightStartLocalTime: v.nightStartLocalTime,
      nightEndLocalTime: v.nightEndLocalTime,
      peakStartLocalTime: v.peakStartLocalTime,
      peakEndLocalTime: v.peakEndLocalTime,
      fixedCharges: chargesByVersion.get(v.id) ?? [],
    };
  });

  const activeVersion = allVersions.find((v) => v.id === activeVersionRow?.id) ?? null;

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

// ---------------------------------------------------------------------------
// Load a single version for the editor (edit mode)
// ---------------------------------------------------------------------------

export async function loadVersionForEdit(
  versionId: string,
  installationId: string,
): Promise<TariffVersionEditData | null> {
  const {
    db,
    tariffPlans,
    tariffPlanVersions,
    tariffPricePeriods,
    tariffFixedChargeVersions,
    installationContracts,
  } = await getDeps();

  const planRows = await db
    .select({
      id: tariffPlans.id,
      supplierName: tariffPlans.supplierName,
      planName: tariffPlans.planName,
      productCode: tariffPlans.productCode,
      isExportEnabled: tariffPlans.isExportEnabled,
    })
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) return null;

  const planMap = new Map(planRows.map((p) => [p.id, p]));
  const planIds = planRows.map((p) => p.id);

  const versionRow = await db
    .select({
      id: tariffPlanVersions.id,
      tariffPlanId: tariffPlanVersions.tariffPlanId,
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
    .where(
      and(
        eq(tariffPlanVersions.id, versionId),
        planIds.length === 1
          ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
          : inArray(tariffPlanVersions.tariffPlanId, planIds),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!versionRow) return null;

  const plan = planMap.get(versionRow.tariffPlanId) ?? planRows[0];

  const [pricePeriods, fixedCharges, allVersionRows, contract] = await Promise.all([
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
      .where(eq(tariffPricePeriods.tariffPlanVersionId, versionRow.id))
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
      .where(eq(tariffFixedChargeVersions.tariffPlanVersionId, versionRow.id))
      .orderBy(asc(tariffFixedChargeVersions.validFromLocalDate)),

    db
      .select({
        id: tariffPlanVersions.id,
        versionLabel: tariffPlanVersions.versionLabel,
        validFromLocalDate: tariffPlanVersions.validFromLocalDate,
        validToLocalDate: tariffPlanVersions.validToLocalDate,
        isActiveDefault: tariffPlanVersions.isActiveDefault,
        dayRate: tariffPlanVersions.dayRate,
        nightRate: tariffPlanVersions.nightRate,
        peakRate: tariffPlanVersions.peakRate,
        exportRate: tariffPlanVersions.exportRate,
      })
      .from(tariffPlanVersions)
      .where(
        planIds.length === 1
          ? eq(tariffPlanVersions.tariffPlanId, planIds[0])
          : inArray(tariffPlanVersions.tariffPlanId, planIds),
      )
      .orderBy(desc(tariffPlanVersions.validFromLocalDate)),

    db
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
      .then((rows) => rows[0] ?? null),
  ]);

  const version: TariffVersionDetail = {
    ...versionRow,
    supplierName: plan.supplierName,
    planName: plan.planName,
    weeklyScheduleJson: versionRow.weeklyScheduleJson as string[] | null,
    pricePeriods,
    fixedCharges,
  };

  return {
    plan,
    version,
    allVersions: allVersionRows,
    contract,
  };
}
