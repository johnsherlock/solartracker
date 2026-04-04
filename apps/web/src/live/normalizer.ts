import type { MinuteReading, PeriodReading, DayDetailResponse, HealthIncident } from './types';

// Gap threshold: flag suspicious if more than 5 consecutive minutes are missing
const SUSPICIOUS_GAP_THRESHOLD = 5;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toClock(minutesSinceMidnight: number): string {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function getLocalTimeline(date: string, timezone: string): {
  expectedRecordCount: number;
  validOffsets: Set<number>;
  timelineMinutes: Array<{ ts: number; offset: number }>;
} {
  const [year, month, day] = date.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const utcStart = Date.UTC(year, month - 1, day) - (18 * 60 * 60 * 1000);
  const utcEnd = Date.UTC(year, month - 1, day + 1) + (18 * 60 * 60 * 1000);
  let expectedRecordCount = 0;
  const validOffsets = new Set<number>();
  const timelineMinutes: Array<{ ts: number; offset: number }> = [];

  for (let ts = utcStart; ts < utcEnd; ts += 60 * 1000) {
    const parts = formatter.formatToParts(new Date(ts));
    const localYear = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
    const localMonth = Number(parts.find((part) => part.type === 'month')?.value ?? '0');
    const localDay = Number(parts.find((part) => part.type === 'day')?.value ?? '0');

    if (localYear !== year || localMonth !== month || localDay !== day) continue;

    const localHour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const localMinute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    const offset = localHour * 60 + localMinute;
    expectedRecordCount += 1;
    validOffsets.add(offset);
    timelineMinutes.push({ ts, offset });
  }

  return { expectedRecordCount, validOffsets, timelineMinutes };
}

function getLocalDateParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  offset: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '0');
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return { year, month, day, offset: hour * 60 + minute };
}

function getCoverageUpperBoundTs(
  date: string,
  timezone: string,
  fetchedAt: string,
  timelineMinutes: Array<{ ts: number; offset: number }>,
): number | null {
  if (timelineMinutes.length === 0) return null;

  const fetchedAtLocal = getLocalDateParts(new Date(fetchedAt), timezone);
  const [year, month, day] = date.split('-').map(Number);

  if (
    fetchedAtLocal.year === year &&
    fetchedAtLocal.month === month &&
    fetchedAtLocal.day === day
  ) {
    const fetchedMinuteStartTs = Math.floor(new Date(fetchedAt).getTime() / 60_000) * 60_000;
    return fetchedMinuteStartTs;
  }

  const selectedDateUtc = Date.UTC(year, month - 1, day);
  const fetchedDateUtc = Date.UTC(fetchedAtLocal.year, fetchedAtLocal.month - 1, fetchedAtLocal.day);

  if (selectedDateUtc < fetchedDateUtc) {
    return timelineMinutes[timelineMinutes.length - 1]?.ts + 60_000;
  }

  return null;
}

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

export function buildHealth(
  date: string,
  minutes: MinuteReading[],
  fetchedAt: string,
  timezone = 'Europe/Dublin',
): DayDetailResponse['health'] {
  const { expectedRecordCount, validOffsets, timelineMinutes } = getLocalTimeline(date, timezone);
  const coverageUpperBoundTs = getCoverageUpperBoundTs(date, timezone, fetchedAt, timelineMinutes);
  const expectedMinutes =
    coverageUpperBoundTs === null
      ? 0
      : timelineMinutes.filter((minute) => minute.ts < coverageUpperBoundTs).length;
  const recordCount = minutes.length;
  const completenessRatio = expectedRecordCount > 0 ? recordCount / expectedRecordCount : 0;
  const isPartialDay = recordCount < expectedRecordCount;

  // Ignore offsets that do not exist on the selected local day and any provider
  // records that appear to land after the local fetch time.
  const presentOffsets = new Set(
    minutes
      .map((m) => m.hour * 60 + m.minute)
      .filter(
        (offset) =>
          validOffsets.has(offset) &&
          (coverageUpperBoundTs === null ||
            timelineMinutes.some((minute) => minute.offset === offset && minute.ts < coverageUpperBoundTs)),
      ),
  );
  const coveredMinutes =
    coverageUpperBoundTs === null
      ? 0
      : minutes.filter((m) =>
          timelineMinutes.some(
            (minute) =>
              minute.offset === m.hour * 60 + m.minute && minute.ts < coverageUpperBoundTs,
          ),
        ).length;
  const uptimePercent = expectedMinutes > 0 ? (coveredMinutes / expectedMinutes) * 100 : 0;

  // Find the range actually covered: from first to last record
  const allOffsets = Array.from(presentOffsets).sort((a, b) => a - b);
  let hasSuspiciousReadings = false;
  const incidents: HealthIncident[] = [];

  if (allOffsets.length > 0) {
    for (let i = 1; i < allOffsets.length; i++) {
      let gap = 0;
      let firstMissing: number | null = null;
      let lastMissing: number | null = null;

      for (let offset = allOffsets[i - 1] + 1; offset < allOffsets[i]; offset++) {
        if (!validOffsets.has(offset)) continue;
        gap += 1;
        if (firstMissing === null) firstMissing = offset;
        lastMissing = offset;
      }

      if (
        gap > SUSPICIOUS_GAP_THRESHOLD &&
        firstMissing !== null &&
        lastMissing !== null
      ) {
        incidents.push({
          id: `missing-interval:${firstMissing}-${lastMissing}:${gap}`,
          kind: 'missing-interval',
          missingMinutes: gap,
          gapStartsAt: toClock(firstMissing),
          gapEndsAt: toClock(lastMissing),
          message: `Missing ${gap} consecutive minute readings between ${toClock(firstMissing)} and ${toClock(lastMissing)}.`,
        });
      }
    }
  }

  incidents.sort((a, b) => a.gapStartsAt.localeCompare(b.gapStartsAt));
  hasSuspiciousReadings = incidents.length > 0;

  return {
    recordCount,
    isPartialDay,
    completenessRatio,
    expectedMinutes,
    coveredMinutes,
    uptimePercent,
    hasSuspiciousReadings,
    incidents,
    primaryIncident: incidents[0] ?? null,
    fetchedAt,
  };
}

export function buildDayDetail(
  date: string,
  minutes: MinuteReading[],
  fetchedAt: string,
  timezone = 'Europe/Dublin',
  source: DayDetailResponse['meta']['source'] = 'v1-bridge',
): DayDetailResponse {
  return {
    meta: {
      date,
      timezone,
      source,
      fetchedAt,
    },
    minuteData: minutes,
    halfHourData: buildHalfHourData(minutes),
    hourData: buildHourData(minutes),
    summary: buildSummary(minutes),
    health: buildHealth(date, minutes, fetchedAt, timezone),
  };
}
