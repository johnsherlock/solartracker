import {
  getPricePeriodForSlot,
  getScheduledRateForInterval,
  type TariffPricePeriod,
  type TariffVersion,
  type WeeklySchedule,
} from '../domain/billing';
import { migrateWindowsToSchedule } from '../domain/tariff-compat';
import type { TariffContext } from './loader';

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
