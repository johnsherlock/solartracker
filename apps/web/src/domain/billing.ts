// ---------------------------------------------------------------------------
// Schedule-based tariff types
// ---------------------------------------------------------------------------

/**
 * A user-defined import price period within a tariff version.
 * Any number of periods can be created per version.
 */
export type TariffPricePeriod = {
  id: string;
  tariffPlanVersionId: string;
  periodLabel: string;
  ratePerKwh: number;
  /** When true the period is free — rate is treated as 0 for billing purposes. */
  isFreeImport: boolean;
  sortOrder: number;
  /** Hex colour for rendering in the weekly schedule grid (e.g. '#3b82f6'). Null until set by the user. */
  colourHex?: string | null;
};

/**
 * 336-element array (7 days × 48 half-hours) mapping each half-hour slot to a
 * TariffPricePeriod id. Slot index = dayIndex * 48 + slotIndex, where:
 * - dayIndex 0 = Monday … 6 = Sunday (ISO week order)
 * - slotIndex 0 = 00:00 … 47 = 23:30
 */
export type WeeklySchedule = string[];

// ---------------------------------------------------------------------------
// Schedule resolution helpers
// ---------------------------------------------------------------------------

/**
 * Return the ISO day index (0 = Monday … 6 = Sunday) for a local date string.
 */
export const getISODayIndex = (localDate: string): number => {
  // Use UTC parsing to avoid host timezone affecting getDay()
  const d = new Date(`${localDate}T00:00:00Z`);
  // getUTCDay(): 0=Sun, 1=Mon … 6=Sat → remap to Mon=0 … Sun=6
  return (d.getUTCDay() + 6) % 7;
};

/**
 * Return the half-hour slot index (0 = 00:00 … 47 = 23:30) for a local time.
 * Accepts either "HH:MM" or a full "YYYY-MM-DDTHH:MM" string.
 */
export const getSlotIndex = (localDateTime: string): number => {
  const hour = parseInt(localDateTime.slice(-5, -3), 10);
  const minute = parseInt(localDateTime.slice(-2), 10);
  return hour * 2 + (minute >= 30 ? 1 : 0);
};

/**
 * Return the WeeklySchedule slot index (0–335) for a local datetime string.
 * Format: "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS"
 */
export const resolveSlotIndex = (localDateTime: string): number => {
  const localDate = datePart(localDateTime);
  const dayIndex = getISODayIndex(localDate);
  const slotIndex = getSlotIndex(timePart(localDateTime));
  return dayIndex * 48 + slotIndex;
};

/**
 * Return the TariffPricePeriod for a given local datetime, or undefined if the
 * schedule or the referenced period is missing.
 */
export const getPricePeriodForSlot = (
  periods: TariffPricePeriod[],
  schedule: WeeklySchedule,
  localDateTime: string,
): TariffPricePeriod | undefined => {
  const slotIndex = resolveSlotIndex(localDateTime);
  const periodId = schedule[slotIndex];
  return periods.find((p) => p.id === periodId);
};

/**
 * Resolve the effective import rate for a local datetime using the weekly
 * schedule. Returns 0 for free-import periods and 0 when the period is missing
 * from the schedule (defensive fallback).
 */
export const getScheduledRateForInterval = (
  periods: TariffPricePeriod[],
  schedule: WeeklySchedule,
  localDateTime: string,
): number => {
  const period = getPricePeriodForSlot(periods, schedule, localDateTime);
  if (!period) return 0;
  return period.isFreeImport ? 0 : period.ratePerKwh;
};

// ---------------------------------------------------------------------------
// Schedule-based interval billing
// ---------------------------------------------------------------------------

/**
 * Calculate the import cost for one interval reading using a schedule-based
 * tariff version. Discount and VAT from the parent TariffVersion still apply.
 */
export const calculateIntervalImportCostScheduled = (
  reading: IntervalReading,
  tariff: TariffVersion,
  periods: TariffPricePeriod[],
  schedule: WeeklySchedule,
): number => {
  const rate = getScheduledRateForInterval(periods, schedule, reading.intervalStartLocal);
  const discounted = applyDiscountBeforeVat(reading.importKwh * rate, tariff);
  return round(applyVat(discounted, tariff));
};

// ---------------------------------------------------------------------------
// Schedule-based summary-backed billing
// ---------------------------------------------------------------------------

export type ScheduledTariffVersion = TariffVersion & {
  pricePeriods: TariffPricePeriod[];
  weeklySchedule: WeeklySchedule | null;
};

// ---------------------------------------------------------------------------
// Simple-window types and functions follow
// ---------------------------------------------------------------------------

export type IntervalReading = {
  intervalStartLocal: string;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number;
  immersionDivertedKwh?: number;
  immersionBoostedKwh?: number;
};

export type TariffVersion = {
  id: string;
  validFromLocalDate: string;
  validToLocalDate?: string | null;
  dayRate: number;
  nightRate?: number | null;
  peakRate?: number | null;
  exportRate?: number | null;
  vatRate?: number | null;
  discountRuleType?: 'percentage' | null;
  discountValue?: number | null;
  nightStartLocalTime?: string | null;
  nightEndLocalTime?: string | null;
  peakStartLocalTime?: string | null;
  peakEndLocalTime?: string | null;
};

export type FixedChargeVersion = {
  id: string;
  tariffPlanVersionId: string;
  chargeType: string;
  amount: number;
  unit: 'per_day' | 'per_month' | 'per_bill';
  validFromLocalDate: string;
  validToLocalDate?: string | null;
};

export type BillingPeriodResult = {
  actual: {
    importCost: number;
    fixedCharges: number;
    exportCredit: number;
    grossCost: number;
    netCost: number;
  };
  withoutSolar: {
    importCost: number;
    fixedCharges: number;
    grossCost: number;
    netCost: number;
  };
  solar: {
    savings: number;
    exportValue: number;
    selfConsumptionRatio: number;
    gridDependenceRatio: number;
  };
};

const round = (value: number) => Math.round(value * 1000000) / 1000000;

const datePart = (localDateTime: string) => localDateTime.slice(0, 10);
const timePart = (localDateTime: string) => localDateTime.slice(11, 16);

const inDateRange = (date: string, from: string, to?: string | null) => date >= from && (!to || date <= to);

export const inWindow = (time: string, start?: string | null, end?: string | null) => {
  if (!start || !end) return false;
  if (start < end) {
    return time >= start && time < end;
  }

  // Handles windows that cross midnight, such as 23:00-08:00.
  return time >= start || time < end;
};

const applyDiscountBeforeVat = (baseCost: number, tariff: TariffVersion) => {
  if (tariff.discountRuleType !== 'percentage' || tariff.discountValue == null) {
    return baseCost;
  }

  return baseCost * (1 - tariff.discountValue);
};

const applyVat = (baseCost: number, tariff: TariffVersion) => {
  const vatRate = tariff.vatRate ?? 0;
  return baseCost * (1 + vatRate);
};

export const resolveTariffVersion = (versions: TariffVersion[], localDateTime: string): TariffVersion => {
  const localDate = datePart(localDateTime);
  const match = versions.find((version) => inDateRange(localDate, version.validFromLocalDate, version.validToLocalDate));

  if (!match) {
    throw new Error(`No tariff version found for ${localDateTime}`);
  }

  return match;
};

export const getTariffRateForInterval = (tariff: TariffVersion, localDateTime: string) => {
  const localTime = timePart(localDateTime);

  if (inWindow(localTime, tariff.peakStartLocalTime, tariff.peakEndLocalTime) && tariff.peakRate != null) {
    return tariff.peakRate;
  }

  if (inWindow(localTime, tariff.nightStartLocalTime, tariff.nightEndLocalTime) && tariff.nightRate != null) {
    return tariff.nightRate;
  }

  return tariff.dayRate;
};

export const calculateIntervalImportCost = (reading: IntervalReading, tariff: TariffVersion) => {
  const rate = getTariffRateForInterval(tariff, reading.intervalStartLocal);
  const discounted = applyDiscountBeforeVat(reading.importKwh * rate, tariff);
  return round(applyVat(discounted, tariff));
};

export const calculateIntervalExportCredit = (reading: IntervalReading, tariff: TariffVersion) => {
  return round(reading.exportKwh * (tariff.exportRate ?? 0));
};

export const calculateWithoutSolarImportKwh = (reading: IntervalReading) => {
  const immersionDiverted = reading.immersionDivertedKwh ?? 0;
  return round(reading.importKwh + reading.generatedKwh - reading.exportKwh - immersionDiverted);
};

export const fixedChargeContributionForDate = (
  localDate: string,
  tariffVersionId: string,
  fixedChargeVersions: FixedChargeVersion[],
) => {
  return fixedChargeVersions
    .filter((charge) => charge.tariffPlanVersionId === tariffVersionId)
    .filter((charge) => charge.unit === 'per_day')
    .filter((charge) => inDateRange(localDate, charge.validFromLocalDate, charge.validToLocalDate))
    .reduce((sum, charge) => sum + charge.amount, 0);
};

export const calculateBillingPeriod = (
  readings: IntervalReading[],
  tariffVersions: TariffVersion[],
  fixedChargeVersions: FixedChargeVersion[],
): BillingPeriodResult => {
  const actualImportCost = readings.reduce((sum, reading) => {
    const tariff = resolveTariffVersion(tariffVersions, reading.intervalStartLocal);
    return sum + calculateIntervalImportCost(reading, tariff);
  }, 0);

  const exportCredit = readings.reduce((sum, reading) => {
    const tariff = resolveTariffVersion(tariffVersions, reading.intervalStartLocal);
    return sum + calculateIntervalExportCredit(reading, tariff);
  }, 0);

  const uniqueDates = Array.from(new Set(readings.map((reading) => datePart(reading.intervalStartLocal))));

  const fixedCharges = uniqueDates.reduce((sum, localDate) => {
    const tariff = resolveTariffVersion(tariffVersions, `${localDate}T12:00`);
    return sum + fixedChargeContributionForDate(localDate, tariff.id, fixedChargeVersions);
  }, 0);

  const withoutSolarImportCost = readings.reduce((sum, reading) => {
    const tariff = resolveTariffVersion(tariffVersions, reading.intervalStartLocal);
    const withoutSolarImportKwh = calculateWithoutSolarImportKwh(reading);
    const discounted = applyDiscountBeforeVat(withoutSolarImportKwh * getTariffRateForInterval(tariff, reading.intervalStartLocal), tariff);
    return sum + applyVat(discounted, tariff);
  }, 0);

  const totalConsumed = readings.reduce((sum, reading) => sum + reading.consumedKwh, 0);
  const totalImported = readings.reduce((sum, reading) => sum + reading.importKwh, 0);
  const totalExported = readings.reduce((sum, reading) => sum + reading.exportKwh, 0);

  const actualGrossCost = round(actualImportCost + fixedCharges);
  const actualNetCost = round(actualGrossCost - exportCredit);
  const withoutSolarGrossCost = round(withoutSolarImportCost + fixedCharges);
  const withoutSolarNetCost = round(withoutSolarGrossCost);
  const savings = round(withoutSolarNetCost - actualNetCost);
  const selfConsumptionRatio = totalConsumed > 0 ? round((totalConsumed - totalImported) / totalConsumed) : 0;
  const gridDependenceRatio = totalConsumed > 0 ? round(totalImported / totalConsumed) : 0;

  return {
    actual: {
      importCost: round(actualImportCost),
      fixedCharges: round(fixedCharges),
      exportCredit: round(exportCredit),
      grossCost: actualGrossCost,
      netCost: actualNetCost,
    },
    withoutSolar: {
      importCost: round(withoutSolarImportCost),
      fixedCharges: round(fixedCharges),
      grossCost: withoutSolarGrossCost,
      netCost: withoutSolarNetCost,
    },
    solar: {
      savings,
      exportValue: round(exportCredit),
      selfConsumptionRatio,
      gridDependenceRatio,
    },
  };
};

