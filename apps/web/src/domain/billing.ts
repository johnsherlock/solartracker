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

export type DailySummaryForBilling = {
  localDate: string;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
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

const inWindow = (time: string, start?: string | null, end?: string | null) => {
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

/**
 * Calculate billing totals from persisted daily summary rows.
 *
 * Because daily summaries contain only daily totals (not per-interval
 * timestamped readings), time-of-use splitting (night / peak windows) is not
 * possible. The day rate is applied to all import for every day. This matches
 * the simplified-daily-rate approach used elsewhere in the app.
 */
export const calculateBillingFromDailySummaries = (
  summaries: DailySummaryForBilling[],
  tariffVersions: TariffVersion[],
  fixedChargeVersions: FixedChargeVersion[],
): BillingPeriodResult => {
  let actualImportCost = 0;
  let exportCredit = 0;
  let fixedCharges = 0;
  let withoutSolarImportCost = 0;
  let totalConsumed = 0;
  let totalImported = 0;
  let totalExported = 0;

  for (const day of summaries) {
    const tariff = resolveTariffVersion(tariffVersions, `${day.localDate}T12:00`);
    const vat = 1 + (tariff.vatRate ?? 0);
    const discount = tariff.discountRuleType === 'percentage' && tariff.discountValue != null
      ? 1 - tariff.discountValue
      : 1;

    actualImportCost += round(day.importKwh * tariff.dayRate * discount * vat);
    exportCredit += round(day.exportKwh * (tariff.exportRate ?? 0));
    fixedCharges += fixedChargeContributionForDate(day.localDate, tariff.id, fixedChargeVersions);

    const withoutSolarImport = Math.max(0, round(
      day.importKwh + day.generatedKwh - day.exportKwh - day.immersionDivertedKwh,
    ));
    withoutSolarImportCost += round(withoutSolarImport * tariff.dayRate * discount * vat);

    totalConsumed += day.consumedKwh;
    totalImported += day.importKwh;
    totalExported += day.exportKwh;
  }

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
