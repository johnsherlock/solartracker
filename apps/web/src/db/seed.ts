import { sql } from 'drizzle-orm';
import { db, pool } from './client';
import {
  users,
  installations,
  providerConnections,
  tariffPlans,
  tariffPlanVersions,
  tariffPricePeriods,
  tariffFixedChargeVersions,
  installationContracts,
  dailySummaries,
} from './schema';

// ---------------------------------------------------------------------------
// Deterministic IDs — fixed so re-runs are idempotent
// ---------------------------------------------------------------------------

const USER_ID                = '00000000-0000-0000-0000-000000000001';
const ADMIN_USER_ID          = '00000000-0000-0000-0000-000000000009';
const INSTALLATION_ID        = '00000000-0000-0000-0000-000000000002';
const PROVIDER_CONNECTION_ID = '00000000-0000-0000-0000-000000000003';
const TARIFF_PLAN_ID         = '00000000-0000-0000-0000-000000000004';
const TARIFF_VERSION_1_ID    = '00000000-0000-0000-0000-000000000005';
const TARIFF_VERSION_2_ID    = '00000000-0000-0000-0000-000000000006';
const FIXED_CHARGE_V1_ID     = '00000000-0000-0000-0000-000000000007';
const FIXED_CHARGE_V2_ID     = '00000000-0000-0000-0000-000000000008';
const PRICE_PERIOD_DAY_ID    = '00000000-0000-0000-0000-000000000010';
const PRICE_PERIOD_NIGHT_ID  = '00000000-0000-0000-0000-000000000011';
const PRICE_PERIOD_PEAK_ID   = '00000000-0000-0000-0000-000000000012';
const INSTALLATION_CONTRACT_ID = '00000000-0000-0000-0000-000000000013';
const PRICE_PERIOD_FREE_ID   = '00000000-0000-0000-0000-000000000014';

// ---------------------------------------------------------------------------
// Weekly schedule JSON for tariff version 2
// 336 elements (7 days × 48 half-hours, Mon=0, slot 0 = 00:00–00:30)
//
// Mon–Fri + Sun (days 0–4, 6) — standard Night/Day/Peak pattern:
//   Night: 00:00–08:00 (slots 0–15) and 23:00–00:00 (slots 46–47)
//   Peak:  17:00–19:00 (slots 34–37)
//   Day:   everything else
//
// Saturday (day 5) — free energy midday:
//   Night: 00:00–08:00 (slots 0–15) and 23:00–00:00 (slots 46–47)
//   Day:   08:00–10:00 (slots 16–19) and 16:00–23:00 (slots 32–45)
//   Free:  10:00–16:00 (slots 20–31)  isFreeImport
// ---------------------------------------------------------------------------
function buildWeeklySchedule(): string[] {
  const schedule: string[] = [];
  for (let day = 0; day < 7; day++) {
    const isSaturday = day === 5;
    for (let slot = 0; slot < 48; slot++) {
      const isNight = slot <= 15 || slot >= 46;
      if (isNight) {
        schedule.push(PRICE_PERIOD_NIGHT_ID);
      } else if (isSaturday) {
        // Saturday: free 10:00–16:00, day otherwise
        const isFree = slot >= 20 && slot <= 31;
        schedule.push(isFree ? PRICE_PERIOD_FREE_ID : PRICE_PERIOD_DAY_ID);
      } else {
        // Mon–Fri + Sun: peak 17:00–19:00, day otherwise
        const isPeak = slot >= 34 && slot <= 37;
        schedule.push(isPeak ? PRICE_PERIOD_PEAK_ID : PRICE_PERIOD_DAY_ID);
      }
    }
  }
  return schedule;
}

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

/**
 * Approximate band splits for Irish household usage.
 * Night: 23:00–08:00 (~35% of import), Peak: 17:00–19:00 (~10%), Day: remainder.
 * Values sum exactly to importKwh.
 */
const bandSplit = (importKwh: number) => {
  const night = round4(importKwh * 0.35);
  const peak  = round4(importKwh * 0.10);
  const day   = round4(importKwh - night - peak);
  return { night, peak, day };
};

const buildSummaryRow = (day: DayInput) => {
  const consumed = round4(day.importKwh + day.generatedKwh - day.exportKwh - day.immersionDivertedKwh);
  const selfConsumptionRatio = consumed > 0 ? round4((consumed - day.importKwh) / consumed) : 0;
  const gridDependenceRatio  = consumed > 0 ? round4(day.importKwh / consumed) : 0;
  const bands = bandSplit(day.importKwh);

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
    dayImportKwh: String(bands.day),
    nightImportKwh: String(bands.night),
    peakImportKwh: String(bands.peak),
    freeImportKwh: null,
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
      role: 'user',
      status: 'approved',
      approvedAt: new Date('2026-01-01T00:00:00Z'),
      termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        role: sql`excluded.role`,
        status: sql`excluded.status`,
        approvedAt: sql`excluded.approved_at`,
        termsAcceptedAt: sql`excluded.terms_accepted_at`,
      },
    });

    // Admin seed — requires ADMIN_EMAIL in the environment.
    // Skipped in local dev when the env var is absent.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await tx.insert(users).values({
        id: ADMIN_USER_ID,
        authUserId: '00000000-0000-0000-0000-000000000098',
        email: adminEmail,
        displayName: 'Admin',
        role: 'admin',
        status: 'approved',
        approvedAt: new Date('2026-01-01T00:00:00Z'),
        termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`excluded.email`,
          role: sql`excluded.role`,
          status: sql`excluded.status`,
          approvedAt: sql`excluded.approved_at`,
          termsAcceptedAt: sql`excluded.terms_accepted_at`,
        },
      });
      console.log(`  admin user: ok (${adminEmail})`);
    } else {
      console.log('  admin user: skipped (ADMIN_EMAIL not set)');
    }
    console.log('  fixture user: ok');

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
      // Location: Dublin, Ireland — pre-seeded so the weather slice works in dev
      locationRawInput: 'Dublin, Ireland',
      locationDisplayName: 'Dublin, Ireland',
      locationLatitude: '53.349800',
      locationLongitude: '-6.260300',
      locationPrecisionMode: 'exact',
      locationCountryCode: 'IE',
      locationLocality: 'Dublin',
      locationGeocodedAt: new Date('2026-04-03T00:00:00Z'),
      locationGeocoderProvider: 'seed',
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
        locationRawInput: sql`excluded.location_raw_input`,
        locationDisplayName: sql`excluded.location_display_name`,
        locationLatitude: sql`excluded.location_latitude`,
        locationLongitude: sql`excluded.location_longitude`,
        locationPrecisionMode: sql`excluded.location_precision_mode`,
        locationCountryCode: sql`excluded.location_country_code`,
        locationLocality: sql`excluded.location_locality`,
        locationGeocodedAt: sql`excluded.location_geocoded_at`,
        locationGeocoderProvider: sql`excluded.location_geocoder_provider`,
      },
    });
    console.log('  installations: ok');

    await tx.insert(providerConnections).values({
      id: PROVIDER_CONNECTION_ID,
      installationId: INSTALLATION_ID,
      providerType: 'myenergi',
      status: 'active',
      // Dev credential reference — reads MYENERGI_USERNAME and MYENERGI_PASSWORD
      // from the environment. Set these in .env.local to enable direct API access.
      credentialRef: 'env:MYENERGI_USERNAME:MYENERGI_PASSWORD',
    }).onConflictDoUpdate({
      target: providerConnections.id,
      set: { credentialRef: sql`excluded.credential_ref` },
    });
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
        weeklyScheduleJson: buildWeeklySchedule(),
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
        weeklyScheduleJson: sql`excluded.weekly_schedule_json`,
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

    // Price periods for the current (V2) tariff version — used by the weekly schedule
    await tx.insert(tariffPricePeriods).values([
      {
        id: PRICE_PERIOD_DAY_ID,
        tariffPlanVersionId: TARIFF_VERSION_2_ID,
        periodLabel: 'Day',
        ratePerKwh: '0.3865',
        isFreeImport: false,
        sortOrder: 0,
        colourHex: '#f59e0b',
      },
      {
        id: PRICE_PERIOD_NIGHT_ID,
        tariffPlanVersionId: TARIFF_VERSION_2_ID,
        periodLabel: 'Night',
        ratePerKwh: '0.2125',
        isFreeImport: false,
        sortOrder: 1,
        colourHex: '#3b82f6',
      },
      {
        id: PRICE_PERIOD_PEAK_ID,
        tariffPlanVersionId: TARIFF_VERSION_2_ID,
        periodLabel: 'Peak',
        ratePerKwh: '0.4340',
        isFreeImport: false,
        sortOrder: 2,
        colourHex: '#ef4444',
      },
      {
        id: PRICE_PERIOD_FREE_ID,
        tariffPlanVersionId: TARIFF_VERSION_2_ID,
        periodLabel: 'Free',
        ratePerKwh: '0.0000',
        isFreeImport: true,
        sortOrder: 3,
        colourHex: '#22c55e',
      },
    ]).onConflictDoUpdate({
      target: tariffPricePeriods.id,
      set: {
        periodLabel: sql`excluded.period_label`,
        ratePerKwh: sql`excluded.rate_per_kwh`,
        colourHex: sql`excluded.colour_hex`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
    console.log('  tariff_price_periods: ok');

    // Contract with upcoming review and expiry — seeds reminder state for the UI prototype
    await tx.insert(installationContracts).values({
      id: INSTALLATION_CONTRACT_ID,
      installationId: INSTALLATION_ID,
      tariffPlanId: TARIFF_PLAN_ID,
      contractStartDate: '2025-10-10',
      contractEndDate: '2026-06-30',
      expectedReviewDate: '2026-06-01',
      postContractDefaultBehavior: 'roll',
      notes: 'Annual contract with Energia. Rates reviewed each October.',
    }).onConflictDoUpdate({
      target: installationContracts.id,
      set: {
        contractStartDate: sql`excluded.contract_start_date`,
        contractEndDate: sql`excluded.contract_end_date`,
        expectedReviewDate: sql`excluded.expected_review_date`,
        notes: sql`excluded.notes`,
      },
    });
    console.log('  installation_contracts: ok');

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
        dayImportKwh: sql`excluded.day_import_kwh`,
        nightImportKwh: sql`excluded.night_import_kwh`,
        peakImportKwh: sql`excluded.peak_import_kwh`,
        freeImportKwh: sql`excluded.free_import_kwh`,
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
