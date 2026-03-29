import type { MinuteReading, PeriodReading, DayDetailResponse } from './types';

const MINUTES_IN_DAY = 1440;

// Gap threshold: flag suspicious if more than 5 consecutive minutes are missing
const SUSPICIOUS_GAP_THRESHOLD = 5;

function selfConsumptionRatio(consumedKwh: number, importKwh: number): number {
  if (consumedKwh <= 0) return 0;
  const solar = consumedKwh - importKwh;
  if (solar <= 0) return 0;
  return solar / consumedKwh;
}

function gridDependenceRatio(consumedKwh: number, importKwh: number): number {
  if (consumedKwh <= 0) return 0;
  return Math.min(1, importKwh / consumedKwh);
}

export function buildHalfHourData(minutes: MinuteReading[]): PeriodReading[] {
  const buckets = new Map<string, PeriodReading>();

  for (const m of minutes) {
    const bucketMinute: 0 | 30 = m.minute < 30 ? 0 : 30;
    const key = `${m.hour}:${bucketMinute}`;

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        hour: m.hour,
        minute: bucketMinute,
        importKwh: m.importKwh,
        exportKwh: m.exportKwh,
        generatedKwh: m.generatedKwh,
        consumedKwh: m.consumedKwh,
        immersionDivertedKwh: m.immersionDivertedKwh,
        immersionBoostedKwh: m.immersionBoostedKwh,
        selfConsumptionRatio: 0,
      });
    } else {
      existing.importKwh += m.importKwh;
      existing.exportKwh += m.exportKwh;
      existing.generatedKwh += m.generatedKwh;
      existing.consumedKwh += m.consumedKwh;
      existing.immersionDivertedKwh += m.immersionDivertedKwh;
      existing.immersionBoostedKwh += m.immersionBoostedKwh;
    }
  }

  for (const bucket of buckets.values()) {
    bucket.selfConsumptionRatio = selfConsumptionRatio(bucket.consumedKwh, bucket.importKwh);
  }

  return Array.from(buckets.values()).sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

export function buildHourData(minutes: MinuteReading[]): PeriodReading[] {
  const buckets = new Map<number, PeriodReading>();

  for (const m of minutes) {
    const existing = buckets.get(m.hour);
    if (!existing) {
      buckets.set(m.hour, {
        hour: m.hour,
        minute: 0,
        importKwh: m.importKwh,
        exportKwh: m.exportKwh,
        generatedKwh: m.generatedKwh,
        consumedKwh: m.consumedKwh,
        immersionDivertedKwh: m.immersionDivertedKwh,
        immersionBoostedKwh: m.immersionBoostedKwh,
        selfConsumptionRatio: 0,
      });
    } else {
      existing.importKwh += m.importKwh;
      existing.exportKwh += m.exportKwh;
      existing.generatedKwh += m.generatedKwh;
      existing.consumedKwh += m.consumedKwh;
      existing.immersionDivertedKwh += m.immersionDivertedKwh;
      existing.immersionBoostedKwh += m.immersionBoostedKwh;
    }
  }

  for (const bucket of buckets.values()) {
    bucket.selfConsumptionRatio = selfConsumptionRatio(bucket.consumedKwh, bucket.importKwh);
  }

  return Array.from(buckets.values()).sort((a, b) => a.hour - b.hour);
}

export function buildSummary(minutes: MinuteReading[]): DayDetailResponse['summary'] {
  let totalImportKwh = 0;
  let totalExportKwh = 0;
  let totalGeneratedKwh = 0;
  let totalConsumedKwh = 0;
  let totalImmersionDivertedKwh = 0;
  let totalImmersionBoostedKwh = 0;

  for (const m of minutes) {
    totalImportKwh += m.importKwh;
    totalExportKwh += m.exportKwh;
    totalGeneratedKwh += m.generatedKwh;
    totalConsumedKwh += m.consumedKwh;
    totalImmersionDivertedKwh += m.immersionDivertedKwh;
    totalImmersionBoostedKwh += m.immersionBoostedKwh;
  }

  return {
    totalImportKwh,
    totalExportKwh,
    totalGeneratedKwh,
    totalConsumedKwh,
    totalImmersionDivertedKwh,
    totalImmersionBoostedKwh,
    selfConsumptionRatio: selfConsumptionRatio(totalConsumedKwh, totalImportKwh),
    gridDependenceRatio: gridDependenceRatio(totalConsumedKwh, totalImportKwh),
  };
}

export function buildHealth(minutes: MinuteReading[], fetchedAt: string): DayDetailResponse['health'] {
  const recordCount = minutes.length;
  const completenessRatio = recordCount / MINUTES_IN_DAY;
  const isPartialDay = recordCount < MINUTES_IN_DAY;

  // Build the set of (hour * 60 + minute) values present in the data
  const presentMinutes = new Set(minutes.map(m => m.hour * 60 + m.minute));

  // Find the range actually covered: from first to last record
  const allOffsets = Array.from(presentMinutes).sort((a, b) => a - b);
  let hasSuspiciousReadings = false;

  if (allOffsets.length > 0) {
    let maxGap = 0;
    for (let i = 1; i < allOffsets.length; i++) {
      const gap = allOffsets[i] - allOffsets[i - 1] - 1;
      if (gap > maxGap) maxGap = gap;
    }
    hasSuspiciousReadings = maxGap > SUSPICIOUS_GAP_THRESHOLD;
  }

  return {
    recordCount,
    isPartialDay,
    completenessRatio,
    hasSuspiciousReadings,
    fetchedAt,
  };
}

export function buildDayDetail(
  date: string,
  minutes: MinuteReading[],
  fetchedAt: string,
): DayDetailResponse {
  return {
    meta: {
      date,
      timezone: 'Europe/Dublin',
      source: 'v1-bridge',
      fetchedAt,
    },
    minuteData: minutes,
    halfHourData: buildHalfHourData(minutes),
    hourData: buildHourData(minutes),
    summary: buildSummary(minutes),
    health: buildHealth(minutes, fetchedAt),
  };
}
