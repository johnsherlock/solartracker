/**
 * MyEnergi provider adapter.
 *
 * Normalises raw Eddi records (all fields in UTC) into the rewrite-owned
 * MinuteReading shape, with hour/minute expressed in the installation's
 * local timezone.
 *
 * DST handling:
 *   - Each record's UTC epoch is reconstructed from yr/mon/dom/hr/min (UTC).
 *   - The epoch is then converted to local time via Intl.DateTimeFormat.
 *   - Only records whose local date matches the requested date are kept.
 *   - This handles spring-forward (23-hour day), fall-back (25-hour day),
 *     and the midnight boundary record naturally without position tracking.
 */

import type { EddiRecord } from './types';
import type { MinuteReading } from '../../live/types';

const JOULES_PER_KWH = 3_600_000;

function joulesToKwh(joules: number): number {
  return joules / JOULES_PER_KWH;
}

function selfConsumptionRatio(consumedKwh: number, importKwh: number): number {
  if (consumedKwh <= 0) return 0;
  const solar = consumedKwh - importKwh;
  if (solar <= 0) return 0;
  return solar / consumedKwh;
}

type LocalDateTime = {
  date: string;  // YYYY-MM-DD
  hour: number;
  minute: number;
};

function utcEpochToLocal(utcMs: number, timezone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return { date: `${year}-${month}-${day}`, hour, minute };
}

function recordToUtcMs(record: EddiRecord): number {
  return Date.UTC(
    record.yr,
    record.mon - 1,
    record.dom,
    record.hr ?? 0,
    record.min ?? 0,
  );
}

function mapRecord(record: EddiRecord, localHour: number, localMinute: number): MinuteReading {
  const importKwh = joulesToKwh(record.imp ?? 0);
  const generatedKwh = joulesToKwh(record.gep ?? 0);
  const exportKwh = joulesToKwh(record.exp ?? 0);
  const immersionDivertedKwh = joulesToKwh(record.h1d ?? 0);
  const immersionBoostedKwh = joulesToKwh(record.h1b ?? 0);
  const consumedKwh = Math.max(0, importKwh + generatedKwh - exportKwh - immersionDivertedKwh);

  return {
    hour: localHour,
    minute: localMinute,
    importKwh,
    exportKwh,
    generatedKwh,
    consumedKwh,
    immersionDivertedKwh,
    immersionBoostedKwh,
    selfConsumptionRatio: selfConsumptionRatio(consumedKwh, importKwh),
  };
}

/**
 * Normalise raw Eddi records into MinuteReading[] for the requested local date.
 *
 * Records outside the requested local date (e.g. the boundary record at
 * the start of the next day) are filtered out.
 */
export function normaliseEddiRecords(
  records: EddiRecord[],
  requestedDate: string,
  timezone: string,
): MinuteReading[] {
  const result: MinuteReading[] = [];

  for (const record of records) {
    const utcMs = recordToUtcMs(record);
    const local = utcEpochToLocal(utcMs, timezone);
    if (local.date !== requestedDate) continue;
    result.push(mapRecord(record, local.hour, local.minute));
  }

  return result;
}
