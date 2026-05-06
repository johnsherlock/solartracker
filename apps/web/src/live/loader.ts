import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import SunCalc from 'suncalc';
import {
  calculateIntervalExportCredit,
  calculateIntervalImportCost,
  calculateIntervalImportCostScheduled,
  calculateWithoutSolarImportKwh,
  getScheduledRateForInterval,
  getPricePeriodForSlot,
  type TariffPricePeriod,
  type IntervalReading,
  type TariffVersion,
  type WeeklySchedule,
} from '../domain/billing';
import type { CalendarMetric } from '../calendar/types';
import { computeRepaymentsForPeriod, type RepaymentSchedule } from '../range/recovery';
import type { MinuteReading, PeriodReading, DayDetailResponse } from './types';
import type { SunEvents } from '../weather/types';
import { migrateWindowsToSchedule } from '../domain/tariff-compat';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type InstallationContext = {
  id: string;
  name: string;
  timezone: string;
  arrayCapacityKw: number | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
};

export type TariffContext = {
  versionId: string;
  supplierName: string;
  planName: string;
  dayRate: number;
  nightRate: number | null;
  peakRate: number | null;
  exportRate: number | null;
  vatRate: number | null;
  discountRuleType: 'percentage' | null;
  discountValue: number | null;
  nightStartLocalTime: string | null;
  nightEndLocalTime: string | null;
  peakStartLocalTime: string | null;
  peakEndLocalTime: string | null;
  weeklySchedule: WeeklySchedule | null;
  pricePeriods: TariffPricePeriod[];
};

export type FinancialEstimate = {
  importCost: number;
  exportCredit: number;
  solarSavings: number;
  netBillImpact: number;
  /** Describes whether the estimate is interval-priced or uses the fallback flat day rate. */
  note: 'interval-priced-half-hour' | 'simplified-daily-rate';
};

export type GenerationRank = {
  rank: number;
  total: number;
};

export type HistoricalMetricRanks = Partial<Record<CalendarMetric, GenerationRank>>;

export type TariffBreakdownSlice = {
  key: string;
  label: string;
  importKwh: number;
  importCost: number;
  solarKwh: number;
  solarValue: number;
  color: string;
};

export type CurrentMetrics = {
  generatedKw: number;
  consumedKw: number;
  importKw: number;
  exportKw: number;
  immersionKw: number;
  solarShare: number; // 0–100
  gridShare: number;  // 0–100
};

/** A chart-ready data point with kW values for all four energy flows. */
export type LivePoint = {
  time: string;        // "HH:MM"
  generation: number;  // kW
  consumption: number; // kW
  import: number;      // kW
  export: number;      // kW
  immersion: number;   // kW
  intervalHours: number;
};

export type CostPoint = {
  time: string;
  importCost: number;
  savings: number;
  exportCredit: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_MINUTES = 30;

type LiveLoaderDbModule = typeof import('../db/client');
type LiveLoaderSchemaModule = typeof import('../db/schema');

let _dbDeps:
  | Promise<{
      db: LiveLoaderDbModule['db'];
      installations: LiveLoaderSchemaModule['installations'];
      providerConnections: LiveLoaderSchemaModule['providerConnections'];
      tariffPlans: LiveLoaderSchemaModule['tariffPlans'];
      tariffPlanVersions: LiveLoaderSchemaModule['tariffPlanVersions'];
      tariffPricePeriods: LiveLoaderSchemaModule['tariffPricePeriods'];
      dailyPricedRollups: LiveLoaderSchemaModule['dailyPricedRollups'];
    }>
  | null = null;

async function getDbDeps() {
  if (!_dbDeps) {
    _dbDeps = Promise.all([import('../db/client'), import('../db/schema')]).then(
      ([client, schema]) => ({
        db: client.db,
        installations: schema.installations,
        providerConnections: schema.providerConnections,
        tariffPlans: schema.tariffPlans,
        tariffPlanVersions: schema.tariffPlanVersions,
        tariffPricePeriods: schema.tariffPricePeriods,
        dailyPricedRollups: schema.dailyPricedRollups,
      }),
    );
  }

  return _dbDeps;
}

function getClockMinutes(now: Date, timezone?: string): number {
  if (!timezone) {
    return now.getHours() * 60 + now.getMinutes();
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return hour * 60 + minute;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// DB loaders
// ---------------------------------------------------------------------------

export async function loadInstallationContext(
  installationId: string,
): Promise<InstallationContext | null> {
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
    arrayCapacityKw: row.arrayCapacityKw != null ? Number(row.arrayCapacityKw) : null,
    locationLatitude: row.locationLatitude != null ? Number(row.locationLatitude) : null,
    locationLongitude: row.locationLongitude != null ? Number(row.locationLongitude) : null,
  };
}

function parseClockMinutes(time: string): number | null {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function getLocalClockMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return (hours * 60) + minutes;
}

export function computeDaylightCoverage(
  date: string,
  timezone: string,
  latitude: number | null,
  longitude: number | null,
  minuteChartData: LivePoint[],
): number | null {
  if (
    latitude == null ||
    longitude == null ||
    minuteChartData.length === 0
  ) {
    return null;
  }

  const sunTimes = SunCalc.getTimes(new Date(`${date}T12:00:00Z`), latitude, longitude);
  const sunriseMinutes = getLocalClockMinutes(sunTimes.sunrise, timezone);
  const sunsetMinutes = getLocalClockMinutes(sunTimes.sunset, timezone);

  if (sunsetMinutes <= sunriseMinutes) {
    return null;
  }

  let daylightConsumedKwh = 0;
  let daylightSolarSuppliedKwh = 0;

  for (const point of minuteChartData) {
    const pointMinutes = parseClockMinutes(point.time);
    if (pointMinutes == null || pointMinutes < sunriseMinutes || pointMinutes >= sunsetMinutes) {
      continue;
    }

    const consumedKwh = point.consumption * point.intervalHours;
    const importedKwh = point.import * point.intervalHours;
    const solarSuppliedKwh = Math.max(0, Math.min(consumedKwh, consumedKwh - importedKwh));

    daylightConsumedKwh += consumedKwh;
    daylightSolarSuppliedKwh += solarSuppliedKwh;
  }

  if (daylightConsumedKwh <= 0) {
    return null;
  }

  return Math.round((daylightSolarSuppliedKwh / daylightConsumedKwh) * 100);
}

export function computeHistoricalSunEvents(
  date: string,
  latitude: number | null,
  longitude: number | null,
): SunEvents | null {
  if (latitude == null || longitude == null) {
    return null;
  }

  const sunTimes = SunCalc.getTimes(new Date(`${date}T12:00:00Z`), latitude, longitude);
  const sunriseMs = sunTimes.sunrise.getTime();
  const sunsetMs = sunTimes.sunset.getTime();

  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs) || sunsetMs <= sunriseMs) {
    return null;
  }

  const solarNoonMs = sunriseMs + Math.floor((sunsetMs - sunriseMs) / 2);

  return {
    localDate: date,
    sunriseUtc: sunTimes.sunrise.toISOString(),
    sunsetUtc: sunTimes.sunset.toISOString(),
    solarNoonUtc: new Date(solarNoonMs).toISOString(),
    daylightSeconds: Math.round((sunsetMs - sunriseMs) / 1000),
  };
}

const DEFAULT_PERIOD_COLORS = ['#f59e0b', '#38bdf8', '#fb7185', '#34d399', '#a78bfa', '#f97316'];

function getEffectiveTariffPeriods(
  tariff: TariffContext,
  date: string,
): { tariffVersion: TariffVersion; pricePeriods: TariffPricePeriod[]; weeklySchedule: WeeklySchedule } {
  const tariffVersion = toBillingTariffVersion(tariff, date);
  if (tariff.weeklySchedule && tariff.pricePeriods.length > 0) {
    return {
      tariffVersion,
      pricePeriods: tariff.pricePeriods,
      weeklySchedule: tariff.weeklySchedule,
    };
  }

  const migrated = migrateWindowsToSchedule(tariffVersion);
  return {
    tariffVersion,
    pricePeriods: migrated.periods,
    weeklySchedule: migrated.schedule,
  };
}

export function getTariffStateAt(
  tariff: TariffContext,
  date: string,
  time: string,
): { label: string; ratePerKwh: number; isFreeImport: boolean } {
  const { tariffVersion, pricePeriods, weeklySchedule } = getEffectiveTariffPeriods(tariff, date);
  const localDateTime = `${date}T${time}`;
  const matchedPeriod = getPricePeriodForSlot(pricePeriods, weeklySchedule, localDateTime);
  const ratePerKwh = matchedPeriod
    ? getScheduledRateForInterval(pricePeriods, weeklySchedule, localDateTime)
    : tariffVersion.dayRate;

  return {
    label: matchedPeriod?.periodLabel ?? 'Day',
    ratePerKwh,
    isFreeImport: matchedPeriod?.isFreeImport ?? ratePerKwh === 0,
  };
}

function getPeriodColor(period: TariffPricePeriod, index: number): string {
  return period.colourHex ?? DEFAULT_PERIOD_COLORS[index % DEFAULT_PERIOD_COLORS.length];
}

export function computeTariffBreakdown(
  periods: PeriodReading[],
  date: string,
  tariff: TariffContext,
): TariffBreakdownSlice[] {
  const { tariffVersion, pricePeriods, weeklySchedule } = getEffectiveTariffPeriods(tariff, date);
  const pricePeriodIndex = new Map(pricePeriods.map((period, index) => [period.id, index]));
  const buckets = new Map<string, TariffBreakdownSlice>();

  for (const period of periods) {
    const reading = toIntervalReading(date, period);
    const matchedPeriod = getPricePeriodForSlot(pricePeriods, weeklySchedule, reading.intervalStartLocal);
    const key = matchedPeriod?.id ?? 'unclassified';
    const label = matchedPeriod?.periodLabel ?? 'Standard';
    const color = matchedPeriod
      ? getPeriodColor(matchedPeriod, pricePeriodIndex.get(matchedPeriod.id) ?? 0)
      : DEFAULT_PERIOD_COLORS[0];
    const importCost = calculateIntervalImportCostScheduled(
      reading,
      tariffVersion,
      pricePeriods,
      weeklySchedule,
    );
    const withoutSolarReading: IntervalReading = {
      ...reading,
      importKwh: calculateWithoutSolarImportKwh(reading),
    };
    const solarValue =
      calculateIntervalImportCostScheduled(
        withoutSolarReading,
        tariffVersion,
        pricePeriods,
        weeklySchedule,
      ) - importCost;

    const current = buckets.get(key) ?? {
      key,
      label,
      color,
      importKwh: 0,
      importCost: 0,
      solarKwh: 0,
      solarValue: 0,
    };
    const solarKwh = Math.max(0, reading.consumedKwh - reading.importKwh);
    current.importKwh += reading.importKwh;
    current.importCost += importCost;
    current.solarKwh += solarKwh;
    current.solarValue += solarValue;
    buckets.set(key, current);
  }

  return Array.from(buckets.values())
    .map((slice) => ({
      ...slice,
      importKwh: r2(slice.importKwh),
      importCost: r2(slice.importCost),
      solarKwh: r2(slice.solarKwh),
      solarValue: r2(slice.solarValue),
    }))
    .filter((slice) => slice.importCost > 0 || slice.solarValue > 0)
    .sort((a, b) => b.importCost - a.importCost);
}

export async function loadTariffContext(
  installationId: string,
  date: string,
): Promise<TariffContext | null> {
  const { db, tariffPlans, tariffPlanVersions, tariffPricePeriods } = await getDbDeps();

  // Load all plans for the installation — there may be one per tariff year.
  const planRows = await db
    .select()
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId));

  if (planRows.length === 0) return null;

  // Load all versions across all plans, then find the one covering the date.
  const allVersions = await db
    .select()
    .from(tariffPlanVersions)
    .where(inArray(tariffPlanVersions.tariffPlanId, planRows.map((p) => p.id)));

  const active = allVersions
    .filter(
      (v) =>
        v.validFromLocalDate <= date &&
        (v.validToLocalDate === null || v.validToLocalDate >= date),
    )
    .sort((a, b) => b.validFromLocalDate.localeCompare(a.validFromLocalDate))[0];

  if (!active) return null;

  const plan = planRows.find((p) => p.id === active.tariffPlanId)!;
  const pricePeriodRows = await db
    .select()
    .from(tariffPricePeriods)
    .where(eq(tariffPricePeriods.tariffPlanVersionId, active.id))
    .orderBy(tariffPricePeriods.sortOrder);

  return {
    versionId: active.id,
    supplierName: plan.supplierName,
    planName: plan.planName,
    dayRate: Number(active.dayRate),
    nightRate: active.nightRate != null ? Number(active.nightRate) : null,
    peakRate: active.peakRate != null ? Number(active.peakRate) : null,
    exportRate: active.exportRate != null ? Number(active.exportRate) : null,
    vatRate: active.vatRate != null ? Number(active.vatRate) : null,
    discountRuleType:
      active.discountRuleType === 'percentage' ? 'percentage' : null,
    discountValue: active.discountValue != null ? Number(active.discountValue) : null,
    nightStartLocalTime: active.nightStartLocalTime ?? null,
    nightEndLocalTime: active.nightEndLocalTime ?? null,
    peakStartLocalTime: active.peakStartLocalTime ?? null,
    peakEndLocalTime: active.peakEndLocalTime ?? null,
    weeklySchedule: active.weeklyScheduleJson as WeeklySchedule | null,
    pricePeriods: pricePeriodRows.map((period) => ({
      id: period.id,
      tariffPlanVersionId: period.tariffPlanVersionId,
      periodLabel: period.periodLabel,
      ratePerKwh: Number(period.ratePerKwh),
      isFreeImport: period.isFreeImport,
      sortOrder: period.sortOrder,
      colourHex: period.colourHex ?? null,
    })),
  };
}

export type ProviderConnectionContext = {
  id: string;
  credentialRef: string | null;
};

export async function loadProviderConnection(
  installationId: string,
): Promise<ProviderConnectionContext | null> {
  const { db, providerConnections } = await getDbDeps();
  const rows = await db
    .select()
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.installationId, installationId),
        eq(providerConnections.providerType, 'myenergi'),
        eq(providerConnections.status, 'active'),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row.id, credentialRef: row.credentialRef ?? null };
}

export async function loadHistoricalMetricRanksForYear(
  installationId: string,
  date: string,
  comparisonEndDate: string,
  repaymentSchedules: RepaymentSchedule[] = [],
): Promise<HistoricalMetricRanks> {
  const { db, dailyPricedRollups } = await getDbDeps();
  const year = date.slice(0, 4);
  const yearStart = `${year}-01-01`;

  const rows = await db
    .select({
      localDate: dailyPricedRollups.localDate,
      generatedKwh: dailyPricedRollups.generatedKwh,
      consumedKwh: dailyPricedRollups.consumedKwh,
      importKwh: dailyPricedRollups.importKwh,
      exportKwh: dailyPricedRollups.exportKwh,
      immersionDivertedKwh: dailyPricedRollups.immersionDivertedKwh,
      importCost: dailyPricedRollups.importCost,
      exportCredit: dailyPricedRollups.exportCredit,
      selfConsumedSolarValue: dailyPricedRollups.selfConsumedSolarValue,
      fixedCharges: dailyPricedRollups.fixedCharges,
    })
    .from(dailyPricedRollups)
    .where(
      and(
        eq(dailyPricedRollups.installationId, installationId),
        eq(dailyPricedRollups.isPartial, false),
        gte(dailyPricedRollups.localDate, yearStart),
        lte(dailyPricedRollups.localDate, comparisonEndDate),
      ),
    );

  const days = rows.map((row) => ({
    localDate: row.localDate,
    generatedKwh: Number(row.generatedKwh),
    consumedKwh: Number(row.consumedKwh),
    importKwh: Number(row.importKwh),
    exportKwh: Number(row.exportKwh),
    immersionDivertedKwh: Number(row.immersionDivertedKwh),
    importCost: row.importCost != null ? Number(row.importCost) : null,
    exportCredit: row.exportCredit != null ? Number(row.exportCredit) : null,
    selfConsumedSolarValue:
      row.selfConsumedSolarValue != null ? Number(row.selfConsumedSolarValue) : null,
    fixedCharges: row.fixedCharges != null ? Number(row.fixedCharges) : null,
  }));

  const selectedDay = days.find((day) => day.localDate === date);
  if (!selectedDay || days.length === 0) return {};

  const total = days.length;
  const rankMetric = (
    getter: (day: (typeof days)[number]) => number | null,
    lowerBetter = false,
  ): GenerationRank | undefined => {
    const selectedValue = getter(selectedDay);
    if (selectedValue == null) return undefined;

    const betterDays = days.filter((day) => {
      const value = getter(day);
      if (value == null) return false;
      return lowerBetter ? value < selectedValue : value > selectedValue;
    }).length;

    return { rank: betterDays + 1, total };
  };

  return {
    generation_kwh: rankMetric((day) => day.generatedKwh),
    consumed_kwh: rankMetric((day) => day.consumedKwh),
    import_kwh: rankMetric((day) => day.importKwh, true),
    export_kwh: rankMetric((day) => day.exportKwh),
    immersion_kwh: rankMetric((day) => day.immersionDivertedKwh),
    import_cost: rankMetric((day) => day.importCost, true),
    export_credit: rankMetric((day) => day.exportCredit),
    self_consumed_value: rankMetric((day) => day.selfConsumedSolarValue),
    net_energy_bill: rankMetric(
      (day) =>
        day.importCost != null && day.fixedCharges != null && day.exportCredit != null
          ? day.importCost + day.fixedCharges - day.exportCredit
          : null,
      true,
    ),
    total_solar_value: rankMetric(
      (day) =>
        day.selfConsumedSolarValue != null && day.exportCredit != null
          ? day.selfConsumedSolarValue + day.exportCredit
          : null,
    ),
    prorata_coverage: rankMetric((day) => {
      if (day.selfConsumedSolarValue == null || day.exportCredit == null || repaymentSchedules.length === 0) {
        return null;
      }
      const dailyRepayment = computeRepaymentsForPeriod(
        repaymentSchedules,
        day.localDate,
        day.localDate,
        false,
      ).amount;
      if (dailyRepayment <= 0) return null;
      return (day.selfConsumedSolarValue + day.exportCredit) / dailyRepayment;
    }),
  };
}

// ---------------------------------------------------------------------------
// Financial estimate
// ---------------------------------------------------------------------------

/**
 * Compute a simplified financial estimate for the current day using only the
 * day rate. Time-of-use splitting (peak / night) is not applied here because
 * the interval readings are stored as kWh totals, not timestamped per-minute
 * kWh that could be resolved against a tariff window.
 */
export function computeFinancialEstimate(
  summary: DayDetailResponse['summary'],
  tariff: TariffContext,
): FinancialEstimate {
  const vat = 1 + (tariff.vatRate ?? 0);
  const dayRate = tariff.dayRate;
  const exportRate = tariff.exportRate ?? 0;

  const importCost = r2(summary.totalImportKwh * dayRate * vat);
  const exportCredit = r2(summary.totalExportKwh * exportRate);
  const solarConsumed = Math.max(0, summary.totalGeneratedKwh - summary.totalExportKwh);
  const solarSavings = r2(solarConsumed * dayRate * vat);
  const netBillImpact = r2(importCost - exportCredit);

  return { importCost, exportCredit, solarSavings, netBillImpact, note: 'simplified-daily-rate' };
}

export function computeFinancialEstimateFromCostPoints(costPoints: CostPoint[]): FinancialEstimate {
  const importCost = r2(costPoints.reduce((sum, point) => sum + point.importCost, 0));
  const exportCredit = r2(costPoints.reduce((sum, point) => sum + point.exportCredit, 0));
  const solarSavings = r2(costPoints.reduce((sum, point) => sum + point.savings, 0));
  const netBillImpact = r2(importCost - exportCredit);

  return { importCost, exportCredit, solarSavings, netBillImpact, note: 'interval-priced-half-hour' };
}

// ---------------------------------------------------------------------------
// Screen state derivation
// ---------------------------------------------------------------------------

export function deriveScreenState(
  health: DayDetailResponse['health'],
  minuteData: MinuteReading[],
  now: Date,
  timezone?: string,
): 'healthy' | 'stale' | 'warning' | 'disconnected' {
  if (minuteData.length === 0) return 'disconnected';
  if (health.hasSuspiciousReadings) return 'warning';

  const last = minuteData[minuteData.length - 1];
  const lastMin = last.hour * 60 + last.minute;
  const nowMin = getClockMinutes(now, timezone);
  const stale = Math.max(0, nowMin - lastMin);

  return stale > STALE_MINUTES ? 'stale' : 'healthy';
}

export function getMinutesStale(
  minuteData: MinuteReading[],
  now: Date,
  timezone?: string,
): number | null {
  if (minuteData.length === 0) return null;
  const last = minuteData[minuteData.length - 1];
  return Math.max(0, getClockMinutes(now, timezone) - (last.hour * 60 + last.minute));
}

export function getLastReadingLocalTime(minuteData: MinuteReading[]): string | null {
  if (minuteData.length === 0) return null;
  const last = minuteData[minuteData.length - 1];
  return `${pad2(last.hour)}:${pad2(last.minute)}`;
}

// ---------------------------------------------------------------------------
// Current metrics (instantaneous kW from the most recent minute reading)
// ---------------------------------------------------------------------------

export function getCurrentMetrics(minuteData: MinuteReading[]): CurrentMetrics | null {
  if (minuteData.length === 0) return null;
  const last = minuteData[minuteData.length - 1];

  // kWh per minute → kW: multiply by 60
  const generatedKw = r2(last.generatedKwh * 60);
  const consumedKw = r2(last.consumedKwh * 60);
  const importKw = r2(last.importKwh * 60);
  const exportKw = r2(last.exportKwh * 60);
  const immersionKw = r2(last.immersionDivertedKwh * 60);

  const solarConsumedKw = Math.max(0, generatedKw - exportKw);
  const solarShare =
    consumedKw > 0 ? Math.round(Math.min(100, (solarConsumedKw / consumedKw) * 100)) : 0;

  return {
    generatedKw,
    consumedKw,
    importKw,
    exportKw,
    immersionKw,
    solarShare,
    gridShare: 100 - solarShare,
  };
}

// ---------------------------------------------------------------------------
// Chart data conversion
// ---------------------------------------------------------------------------

/**
 * Aggregate minute readings into 5-minute chart points.
 * Within each 5-minute bucket the values are averaged, then converted to kW.
 */
export function minuteDataToFiveMinPoints(minuteData: MinuteReading[]): LivePoint[] {
  const buckets = new Map<
    string,
    { sumGen: number; sumConp: number; sumImp: number; sumExp: number; sumImm: number; count: number }
  >();

  for (const m of minuteData) {
    const block = Math.floor(m.minute / 5) * 5;
    const key = `${pad2(m.hour)}:${pad2(block)}`;
    const b = buckets.get(key) ?? {
      sumGen: 0,
      sumConp: 0,
      sumImp: 0,
      sumExp: 0,
      sumImm: 0,
      count: 0,
    };
    b.sumGen += m.generatedKwh;
    b.sumConp += m.consumedKwh;
    b.sumImp += m.importKwh;
    b.sumExp += m.exportKwh;
    b.sumImm += m.immersionDivertedKwh;
    b.count++;
    buckets.set(key, b);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, b]) => ({
      time,
      // Average kWh per minute in the bucket, converted to kW (×60)
      generation: r2((b.sumGen / b.count) * 60),
      consumption: r2((b.sumConp / b.count) * 60),
      import: r2((b.sumImp / b.count) * 60),
      export: r2((b.sumExp / b.count) * 60),
      immersion: r2((b.sumImm / b.count) * 60),
      intervalHours: 5 / 60,
    }));
}

export function minuteDataToChartPoints(minuteData: MinuteReading[]): LivePoint[] {
  return minuteData.map((m) => ({
    time: `${pad2(m.hour)}:${pad2(m.minute)}`,
    generation: r2(m.generatedKwh * 60),
    consumption: r2(m.consumedKwh * 60),
    import: r2(m.importKwh * 60),
    export: r2(m.exportKwh * 60),
    immersion: r2(m.immersionDivertedKwh * 60),
    intervalHours: 1 / 60,
  }));
}

/**
 * Convert aggregated period readings to chart points.
 * @param periodMinutes - Duration of each period (30 for half-hour, 60 for hourly)
 */
export function periodDataToChartPoints(
  periods: PeriodReading[],
  periodMinutes: number,
): LivePoint[] {
  // kW = kWh / hours = kWh * 60 / periodMinutes
  const factor = 60 / periodMinutes;
  return periods.map((p) => ({
    time: `${pad2(p.hour)}:${pad2(p.minute)}`,
    generation: r2(p.generatedKwh * factor),
    consumption: r2(p.consumedKwh * factor),
    import: r2(p.importKwh * factor),
    export: r2(p.exportKwh * factor),
    immersion: r2(p.immersionDivertedKwh * factor),
    intervalHours: periodMinutes / 60,
  }));
}

function toBillingTariffVersion(tariff: TariffContext, date: string): TariffVersion {
  return {
    id: tariff.versionId,
    validFromLocalDate: date,
    validToLocalDate: date,
    dayRate: tariff.dayRate,
    nightRate: tariff.nightRate,
    peakRate: tariff.peakRate,
    exportRate: tariff.exportRate,
    vatRate: tariff.vatRate,
    discountRuleType: tariff.discountRuleType,
    discountValue: tariff.discountValue,
    nightStartLocalTime: tariff.nightStartLocalTime,
    nightEndLocalTime: tariff.nightEndLocalTime,
    peakStartLocalTime: tariff.peakStartLocalTime,
    peakEndLocalTime: tariff.peakEndLocalTime,
  };
}

function toIntervalReading(date: string, period: PeriodReading): IntervalReading {
  return {
    intervalStartLocal: `${date}T${pad2(period.hour)}:${pad2(period.minute)}`,
    importKwh: period.importKwh,
    exportKwh: period.exportKwh,
    generatedKwh: period.generatedKwh,
    consumedKwh: period.consumedKwh,
    immersionDivertedKwh: period.immersionDivertedKwh,
    immersionBoostedKwh: period.immersionBoostedKwh,
  };
}

export function periodDataToCostPoints(
  periods: PeriodReading[],
  date: string,
  tariff: TariffContext,
): CostPoint[] {
  const { tariffVersion, pricePeriods, weeklySchedule } = getEffectiveTariffPeriods(tariff, date);

  return periods.map((period) => {
    const reading = toIntervalReading(date, period);
    const importCost = calculateIntervalImportCostScheduled(
      reading,
      tariffVersion,
      pricePeriods,
      weeklySchedule,
    );
    const exportCredit = calculateIntervalExportCredit(reading, tariffVersion);
    const withoutSolarReading: IntervalReading = {
      ...reading,
      importKwh: calculateWithoutSolarImportKwh(reading),
    };
    const savings =
      calculateIntervalImportCostScheduled(
        withoutSolarReading,
        tariffVersion,
        pricePeriods,
        weeklySchedule,
      ) - importCost;

    return {
      time: `${pad2(period.hour)}:${pad2(period.minute)}`,
      importCost: r2(importCost),
      savings: r2(savings),
      exportCredit: r2(exportCredit),
    };
  });
}
