import { sql } from 'drizzle-orm';
import { db, pool } from './client';
import {
  adminUsers,
  users,
  installations,
  providerConnections,
  tariffPlans,
  tariffPlanVersions,
  tariffPricePeriods,
  tariffFixedChargeVersions,
  installationContracts,
  intervalReadings,
  systemAdditions,
} from './schema';
import { hashPassword } from '../admin-auth';

// ---------------------------------------------------------------------------
// Deterministic IDs — fixed so re-runs are idempotent
// ---------------------------------------------------------------------------

const USER_ID                = '00000000-0000-0000-0000-000000000001';
const ADMIN_USER_ID          = '00000000-0000-0000-0000-000000000009'; // admin_users.id
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
const SYSTEM_ADDITION_ID     = '00000000-0000-0000-0000-000000000015';

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

// ---------------------------------------------------------------------------
// Interval reading raw inputs
// Dates 2025-10-03 to 2025-10-09 fall under tariff version 1 (rates pre-Oct-10)
// Dates 2025-10-10 to 2025-10-16 fall under tariff version 2 (rates from Oct-10)
// All seeded dates are in BST (UTC+1), so local 00:00 = UTC 23:00 prev day.
// consumed = import + generation - export - immersionDiverted
// ---------------------------------------------------------------------------

type DayInput = {
  localDate: string;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
};

const TIMEZONE = 'Europe/Dublin';
const SLOTS_PER_DAY = 48;

const r6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

/**
 * Return the UTC millisecond timestamp of the first instant of the given local
 * calendar date in the given timezone (same scan used by utcStartOfLocalDate).
 */
function utcStartMs(localDate: string, timezone: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  for (let ts = utcNoon - 14 * 3_600_000; ts < utcNoon + 13 * 3_600_000; ts += 60_000) {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    if (get('year') === year && get('month') === month && get('day') === day) return ts;
  }
  return Date.UTC(year, month - 1, day);
}

/**
 * Build 48 interval rows for a seeded day using a realistic energy pattern:
 *   - Generation concentrated in local 08:00–16:00 (slots 16–31 in BST = UTC 07:00–15:00)
 *   - Import higher at night, lower during generation hours
 *   - Export only during peak generation slots
 *   - Immersion diversion only during generation slots
 * Daily totals match the DayInput values exactly.
 */
function buildIntervalRows(day: DayInput) {
  const utcStart = utcStartMs(day.localDate, TIMEZONE);
  const slotMs = 30 * 60 * 1000;

  // Generation slots (local 08:00–16:00 in BST = UTC slots 14–29 of the local day)
  // In BST local 08:00 = UTC 07:00. Slot 14 = UTC 07:00 (utcStart + 14*30min = +7h).
  const genSlots = new Set<number>();
  for (let i = 14; i <= 29; i++) genSlots.add(i);

  // Distribute generation evenly across gen slots
  const genSlotsCount = genSlots.size;
  const genPerSlot = genSlotsCount > 0 ? day.generatedKwh / genSlotsCount : 0;

  // Distribute export and immersion only in gen slots
  const exportPerSlot = genSlotsCount > 0 ? day.exportKwh / genSlotsCount : 0;
  const immersionPerSlot = genSlotsCount > 0 ? day.immersionDivertedKwh / genSlotsCount : 0;
  const immersionBoostedPerSlot = day.immersionBoostedKwh / SLOTS_PER_DAY;

  // Import: less during generation slots. Remaining import = daily total - gen imports.
  // Night slots get higher import share, gen slots get lower.
  const nightImportShare = 0.55;  // 55% across 18 night slots (local 23:00–08:00 in BST = UTC slots 0–8 and 38–47)
  const nightSlots = new Set<number>([0,1,2,3,4,5,6,7,8,38,39,40,41,42,43,44,45,46,47]);
  const nightSlotsCount = nightSlots.size;
  const importNightPerSlot = nightSlotsCount > 0 ? (day.importKwh * nightImportShare) / nightSlotsCount : 0;
  const remainingImport = day.importKwh - importNightPerSlot * nightSlotsCount;
  const nonNightNonGenSlots = SLOTS_PER_DAY - nightSlotsCount - genSlotsCount;
  const importDayPerSlot = nonNightNonGenSlots > 0 ? (remainingImport * 0.30) / nonNightNonGenSlots : 0;
  const importGenPerSlot = genSlotsCount > 0 ? (remainingImport * 0.70) / genSlotsCount : 0;

  const rows = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const intervalStart = new Date(utcStart + i * slotMs);
    const isNight = nightSlots.has(i);
    const isGen = genSlots.has(i);

    const importKwh = r6(isNight ? importNightPerSlot : isGen ? importGenPerSlot : importDayPerSlot);
    const generationKwh = r6(isGen ? genPerSlot : 0);
    const exportKwh = r6(isGen ? exportPerSlot : 0);
    const immersionDivertedKwh = r6(isGen ? immersionPerSlot : 0);
    const immersionBoostedKwh = r6(immersionBoostedPerSlot);
    const consumedKwh = r6(Math.max(0, importKwh + generationKwh - exportKwh - immersionDivertedKwh));

    rows.push({
      installationId: INSTALLATION_ID,
      intervalStart,
      importKwh: String(importKwh),
      generationKwh: String(generationKwh),
      exportKwh: String(exportKwh),
      immersionDivertedKwh: String(immersionDivertedKwh),
      immersionBoostedKwh: String(immersionBoostedKwh),
      consumedKwh: String(consumedKwh),
      readingCount: 30,
    });
  }
  return rows;
}

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
      status: 'approved',
      approvedAt: new Date('2026-01-01T00:00:00Z'),
      termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        status: sql`excluded.status`,
        approvedAt: sql`excluded.approved_at`,
        termsAcceptedAt: sql`excluded.terms_accepted_at`,
      },
    });
    console.log('  fixture user: ok');

    // Admin seed — requires ADMIN_USERNAME and ADMIN_PASSWORD in the environment.
    // Skipped in local dev when the env vars are absent.
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminUsername && adminPassword) {
      const passwordHash = await hashPassword(adminPassword);
      await tx.insert(adminUsers).values({
        id: ADMIN_USER_ID,
        username: adminUsername,
        passwordHash,
        displayName: 'Admin',
      }).onConflictDoUpdate({
        target: adminUsers.id,
        set: {
          username: sql`excluded.username`,
          passwordHash: sql`excluded.password_hash`,
        },
      });
      console.log(`  admin user: ok (${adminUsername})`);
    } else {
      console.log('  admin user: skipped (ADMIN_USERNAME/ADMIN_PASSWORD not set)');
    }

    await tx.insert(installations).values({
      id: INSTALLATION_ID,
      userId: USER_ID,
      name: 'Fixture Home',
      timezone: 'Europe/Dublin',
      locale: 'en-IE',
      currencyCode: 'EUR',
      arrayCapacityKw: '3.20',
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

    await tx.insert(systemAdditions).values({
      id: SYSTEM_ADDITION_ID,
      installationId: INSTALLATION_ID,
      label: 'Original install',
      additionDate: '2024-04-01',
      capacityAddedKw: '3.20',
      upfrontPayment: null,
      monthlyRepayment: '158.33',
      repaymentDurationMonths: 60,
    }).onConflictDoUpdate({
      target: systemAdditions.id,
      set: {
        label: sql`excluded.label`,
        additionDate: sql`excluded.addition_date`,
        capacityAddedKw: sql`excluded.capacity_added_kw`,
        upfrontPayment: sql`excluded.upfront_payment`,
        monthlyRepayment: sql`excluded.monthly_repayment`,
        repaymentDurationMonths: sql`excluded.repayment_duration_months`,
      },
    });
    console.log('  system additions: ok');

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

    const intervalRows = [...v1Days, ...v2Days].flatMap(buildIntervalRows);
    await tx.insert(intervalReadings).values(intervalRows).onConflictDoUpdate({
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
    console.log(`  interval_readings: ok (${intervalRows.length} rows across ${[...v1Days, ...v2Days].length} days)`);
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
