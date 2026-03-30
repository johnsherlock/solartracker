import { sql } from 'drizzle-orm';
import { db, pool } from './client';
import {
  users,
  installations,
  providerConnections,
  tariffPlans,
  tariffPlanVersions,
  tariffFixedChargeVersions,
  dailySummaries,
} from './schema';

// ---------------------------------------------------------------------------
// Deterministic IDs — fixed so re-runs are idempotent
// ---------------------------------------------------------------------------

const USER_ID                = '00000000-0000-0000-0000-000000000001';
const INSTALLATION_ID        = '00000000-0000-0000-0000-000000000002';
const PROVIDER_CONNECTION_ID = '00000000-0000-0000-0000-000000000003';
const TARIFF_PLAN_ID         = '00000000-0000-0000-0000-000000000004';
const TARIFF_VERSION_1_ID    = '00000000-0000-0000-0000-000000000005';
const TARIFF_VERSION_2_ID    = '00000000-0000-0000-0000-000000000006';
const FIXED_CHARGE_V1_ID     = '00000000-0000-0000-0000-000000000007';
const FIXED_CHARGE_V2_ID     = '00000000-0000-0000-0000-000000000008';

// Daily summary IDs: one per seeded date
const SUMMARY_IDS: Record<string, string> = {
  '2025-10-03': '00000000-0000-0000-0001-000000000001',
  '2025-10-04': '00000000-0000-0000-0001-000000000002',
  '2025-10-05': '00000000-0000-0000-0001-000000000003',
  '2025-10-06': '00000000-0000-0000-0001-000000000004',
  '2025-10-07': '00000000-0000-0000-0001-000000000005',
  '2025-10-08': '00000000-0000-0000-0001-000000000006',
  '2025-10-09': '00000000-0000-0000-0001-000000000007',
  '2025-10-10': '00000000-0000-0000-0001-000000000008',
  '2025-10-11': '00000000-0000-0000-0001-000000000009',
  '2025-10-12': '00000000-0000-0000-0001-000000000010',
  '2025-10-13': '00000000-0000-0000-0001-000000000011',
  '2025-10-14': '00000000-0000-0000-0001-000000000012',
  '2025-10-15': '00000000-0000-0000-0001-000000000013',
  '2025-10-16': '00000000-0000-0000-0001-000000000014',
};

// ---------------------------------------------------------------------------
// Daily summary raw inputs
// Dates 2025-10-03 to 2025-10-09 fall under tariff version 1 (rates pre-Oct-10)
// Dates 2025-10-10 to 2025-10-16 fall under tariff version 2 (rates from Oct-10)
// Values reflect typical autumn Ireland conditions: modest solar, higher import
// consumed = import + generated - export - immersionDiverted
// ---------------------------------------------------------------------------

type DayInput = {
  localDate: string;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const buildSummaryRow = (day: DayInput) => {
  const consumed = round4(day.importKwh + day.generatedKwh - day.exportKwh - day.immersionDivertedKwh);
  const selfConsumptionRatio = consumed > 0 ? round4((consumed - day.importKwh) / consumed) : 0;
  const gridDependenceRatio  = consumed > 0 ? round4(day.importKwh / consumed) : 0;

  return {
    id: SUMMARY_IDS[day.localDate],
    installationId: INSTALLATION_ID,
    localDate: day.localDate,
    importKwh: String(day.importKwh),
    exportKwh: String(day.exportKwh),
    generatedKwh: String(day.generatedKwh),
    consumedKwh: String(consumed),
    immersionDivertedKwh: String(day.immersionDivertedKwh),
    immersionBoostedKwh: String(day.immersionBoostedKwh),
    selfConsumptionRatio: String(selfConsumptionRatio),
    gridDependenceRatio: String(gridDependenceRatio),
    isPartial: false,
  };
};

// V1 period (2025-10-03 to 2025-10-09) — pre rate-change
const v1Days: DayInput[] = [
  { localDate: '2025-10-03', importKwh:  7.5, exportKwh: 1.5, generatedKwh: 4.2, immersionDivertedKwh: 1.0, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-04', importKwh: 11.2, exportKwh: 0.0, generatedKwh: 0.8, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-05', importKwh:  9.8, exportKwh: 0.8, generatedKwh: 3.1, immersionDivertedKwh: 0.6, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-06', importKwh: 12.4, exportKwh: 0.0, generatedKwh: 0.4, immersionDivertedKwh: 0.0, immersionBoostedKwh: 1.2 },
  { localDate: '2025-10-07', importKwh:  8.9, exportKwh: 2.1, generatedKwh: 5.0, immersionDivertedKwh: 1.2, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-08', importKwh: 10.3, exportKwh: 0.3, generatedKwh: 2.5, immersionDivertedKwh: 0.4, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-09', importKwh: 13.1, exportKwh: 0.0, generatedKwh: 0.2, immersionDivertedKwh: 0.0, immersionBoostedKwh: 2.0 },
];

// V2 period (2025-10-10 to 2025-10-16) — post rate-change
const v2Days: DayInput[] = [
  { localDate: '2025-10-10', importKwh:  9.4, exportKwh: 1.0, generatedKwh: 3.6, immersionDivertedKwh: 0.8, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-11', importKwh: 11.6, exportKwh: 0.0, generatedKwh: 0.5, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-12', importKwh:  8.2, exportKwh: 1.8, generatedKwh: 4.5, immersionDivertedKwh: 1.1, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-13', importKwh: 14.0, exportKwh: 0.0, generatedKwh: 0.1, immersionDivertedKwh: 0.0, immersionBoostedKwh: 1.5 },
  { localDate: '2025-10-14', importKwh: 10.7, exportKwh: 0.5, generatedKwh: 2.8, immersionDivertedKwh: 0.5, immersionBoostedKwh: 0.0 },
  { localDate: '2025-10-15', importKwh: 12.9, exportKwh: 0.0, generatedKwh: 0.3, immersionDivertedKwh: 0.0, immersionBoostedKwh: 0.8 },
  { localDate: '2025-10-16', importKwh:  9.1, exportKwh: 1.2, generatedKwh: 3.9, immersionDivertedKwh: 0.9, immersionBoostedKwh: 0.0 },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  await db.transaction(async (tx) => {

    await tx.insert(users).values({
      id: USER_ID,
      authUserId: '00000000-0000-0000-0000-000000000099',
      email: 'dev-fixture@example.com',
      displayName: 'Dev Fixture User',
      status: 'active',
    }).onConflictDoNothing();
    console.log('  users: ok');

    await tx.insert(installations).values({
      id: INSTALLATION_ID,
      userId: USER_ID,
      name: 'Fixture Home',
      timezone: 'Europe/Dublin',
      locale: 'en-IE',
      currencyCode: 'EUR',
      arrayCapacityKw: '3.20',
      financeMode: 'finance',
      installCostAmount: null,
      monthlyFinancePaymentAmount: '158.33',
      financeTermMonths: 60,
      providerType: 'myenergi',
    }).onConflictDoUpdate({
      target: installations.id,
      set: {
        name: sql`excluded.name`,
        timezone: sql`excluded.timezone`,
        locale: sql`excluded.locale`,
        currencyCode: sql`excluded.currency_code`,
        arrayCapacityKw: sql`excluded.array_capacity_kw`,
        financeMode: sql`excluded.finance_mode`,
        installCostAmount: sql`excluded.install_cost_amount`,
        monthlyFinancePaymentAmount: sql`excluded.monthly_finance_payment_amount`,
        financeTermMonths: sql`excluded.finance_term_months`,
        providerType: sql`excluded.provider_type`,
      },
    });
    console.log('  installations: ok');

    await tx.insert(providerConnections).values({
      id: PROVIDER_CONNECTION_ID,
      installationId: INSTALLATION_ID,
      providerType: 'myenergi',
      status: 'active',
    }).onConflictDoNothing();
    console.log('  provider_connections: ok');

    await tx.insert(tariffPlans).values({
      id: TARIFF_PLAN_ID,
      installationId: INSTALLATION_ID,
      supplierName: 'Energia',
      planName: 'Smart Meter 24h',
      isExportEnabled: true,
    }).onConflictDoNothing();
    console.log('  tariff_plans: ok');

    await tx.insert(tariffPlanVersions).values([
      {
        id: TARIFF_VERSION_1_ID,
        tariffPlanId: TARIFF_PLAN_ID,
        versionLabel: 'Energia Smart 24h — Feb 2025',
        validFromLocalDate: '2025-02-28',
        validToLocalDate: '2025-10-09',
        dayRate: '0.3451',
        nightRate: '0.1848',
        peakRate: '0.3617',
        exportRate: '0.2000',
        vatRate: '0.09',
        nightStartLocalTime: '23:00',
        nightEndLocalTime: '08:00',
        peakStartLocalTime: '17:00',
        peakEndLocalTime: '19:00',
        isActiveDefault: false,
      },
      {
        id: TARIFF_VERSION_2_ID,
        tariffPlanId: TARIFF_PLAN_ID,
        versionLabel: 'Energia Smart 24h — Oct 2025',
        validFromLocalDate: '2025-10-10',
        validToLocalDate: null,
        dayRate: '0.3865',
        nightRate: '0.2125',
        peakRate: '0.4340',
        exportRate: '0.1850',
        vatRate: '0.09',
        nightStartLocalTime: '23:00',
        nightEndLocalTime: '08:00',
        peakStartLocalTime: '17:00',
        peakEndLocalTime: '19:00',
        isActiveDefault: true,
      },
    ]).onConflictDoUpdate({
      target: tariffPlanVersions.id,
      set: {
        versionLabel: sql`excluded.version_label`,
        validFromLocalDate: sql`excluded.valid_from_local_date`,
        validToLocalDate: sql`excluded.valid_to_local_date`,
        dayRate: sql`excluded.day_rate`,
        nightRate: sql`excluded.night_rate`,
        peakRate: sql`excluded.peak_rate`,
        exportRate: sql`excluded.export_rate`,
        vatRate: sql`excluded.vat_rate`,
        nightStartLocalTime: sql`excluded.night_start_local_time`,
        nightEndLocalTime: sql`excluded.night_end_local_time`,
        peakStartLocalTime: sql`excluded.peak_start_local_time`,
        peakEndLocalTime: sql`excluded.peak_end_local_time`,
        isActiveDefault: sql`excluded.is_active_default`,
      },
    });
    console.log('  tariff_plan_versions: ok');

    await tx.insert(tariffFixedChargeVersions).values([
      {
        id: FIXED_CHARGE_V1_ID,
        tariffPlanVersionId: TARIFF_VERSION_1_ID,
        chargeType: 'standing_charge',
        amount: '0.59',
        unit: 'per_day',
        vatInclusive: false,
        validFromLocalDate: '2025-02-28',
        validToLocalDate: '2025-10-09',
      },
      {
        id: FIXED_CHARGE_V2_ID,
        tariffPlanVersionId: TARIFF_VERSION_2_ID,
        chargeType: 'standing_charge',
        amount: '0.66',
        unit: 'per_day',
        vatInclusive: false,
        validFromLocalDate: '2025-10-10',
        validToLocalDate: null,
      },
    ]).onConflictDoUpdate({
      target: tariffFixedChargeVersions.id,
      set: {
        chargeType: sql`excluded.charge_type`,
        amount: sql`excluded.amount`,
        unit: sql`excluded.unit`,
        vatInclusive: sql`excluded.vat_inclusive`,
        validFromLocalDate: sql`excluded.valid_from_local_date`,
        validToLocalDate: sql`excluded.valid_to_local_date`,
      },
    });
    console.log('  tariff_fixed_charge_versions: ok');

    const summaryRows = [...v1Days, ...v2Days].map(buildSummaryRow);
    await tx.insert(dailySummaries).values(summaryRows).onConflictDoUpdate({
      target: [dailySummaries.installationId, dailySummaries.localDate],
      set: {
        importKwh: sql`excluded.import_kwh`,
        exportKwh: sql`excluded.export_kwh`,
        generatedKwh: sql`excluded.generated_kwh`,
        consumedKwh: sql`excluded.consumed_kwh`,
        immersionDivertedKwh: sql`excluded.immersion_diverted_kwh`,
        immersionBoostedKwh: sql`excluded.immersion_boosted_kwh`,
        selfConsumptionRatio: sql`excluded.self_consumption_ratio`,
        gridDependenceRatio: sql`excluded.grid_dependence_ratio`,
        isPartial: sql`excluded.is_partial`,
        rebuiltAt: sql`excluded.rebuilt_at`,
      },
    });
    console.log(`  daily_summaries: ok (${summaryRows.length} rows)`);
  });
}

seed()
  .then(() => {
    console.log('Seed complete.');
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
