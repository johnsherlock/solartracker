import { and, eq } from 'drizzle-orm';
import {
  calculateIntervalExportCredit,
  calculateIntervalImportCost,
  calculateWithoutSolarImportKwh,
  type IntervalReading,
  type TariffVersion,
} from '../domain/billing';
import type { MinuteReading, PeriodReading, DayDetailResponse } from './types';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type InstallationContext = {
  id: string;
  name: string;
  timezone: string;
  arrayCapacityKw: number | null;
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
};

export type FinancialEstimate = {
  importCost: number;
  exportCredit: number;
  solarSavings: number;
  netBillImpact: number;
  /** Estimate uses the day rate for all intervals — time-of-use splitting requires interval data. */
  note: 'simplified-daily-rate';
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
  };
}

export async function loadTariffContext(
  installationId: string,
  date: string,
): Promise<TariffContext | null> {
  const { db, tariffPlans, tariffPlanVersions } = await getDbDeps();
  const planRows = await db
    .select()
    .from(tariffPlans)
    .where(eq(tariffPlans.installationId, installationId))
    .limit(1);

  if (planRows.length === 0) return null;
  const plan = planRows[0];

  const allVersions = await db
    .select()
    .from(tariffPlanVersions)
    .where(eq(tariffPlanVersions.tariffPlanId, plan.id));

  // Find the version whose validity window covers the requested date.
  const active = allVersions.find(
    (v) =>
      v.validFromLocalDate <= date &&
      (v.validToLocalDate === null || v.validToLocalDate >= date),
  );

  if (!active) return null;

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
  const tariffVersion = toBillingTariffVersion(tariff, date);

  return periods.map((period) => {
    const reading = toIntervalReading(date, period);
    const importCost = calculateIntervalImportCost(reading, tariffVersion);
    const exportCredit = calculateIntervalExportCredit(reading, tariffVersion);
    const withoutSolarReading: IntervalReading = {
      ...reading,
      importKwh: calculateWithoutSolarImportKwh(reading),
    };
    const savings = calculateIntervalImportCost(withoutSolarReading, tariffVersion) - importCost;

    return {
      time: `${pad2(period.hour)}:${pad2(period.minute)}`,
      importCost: r2(importCost),
      savings: r2(savings),
      exportCredit: r2(exportCredit),
    };
  });
}
