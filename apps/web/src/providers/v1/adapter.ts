/**
 * Temporary V1 bridge adapter.
 * Fetches minute-level data from the legacy V1 endpoint and maps it into
 * the rewrite-owned MinuteReading shape.
 *
 * This module is intentionally server-side only. The V1 endpoint URL must
 * never be exposed to the browser.
 */

import type { V1MinuteRecord } from './types';
import type { MinuteReading } from '../../live/types';

const V1_ENDPOINT = 'https://jmcjm1731b.execute-api.eu-west-1.amazonaws.com/prod/minute-data';

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

function normalizeRequestedDayRecords(raw: V1MinuteRecord[]): V1MinuteRecord[] {
  const normalized: V1MinuteRecord[] = [];
  let previousOffset = -1;

  for (const record of raw) {
    const offset = (record.hr ?? 0) * 60 + (record.min ?? 0);
    if (previousOffset > offset) break;
    normalized.push(record);
    previousOffset = offset;
  }

  return normalized;
}

function mapRecord(record: V1MinuteRecord): MinuteReading {
  const importKwh = joulesToKwh(record.imp ?? 0);
  const exportKwh = joulesToKwh(record.exp ?? 0);
  const generatedKwh = joulesToKwh(record.gep ?? 0);
  const immersionDivertedKwh = joulesToKwh(record.h1d ?? 0);
  const immersionBoostedKwh = joulesToKwh(record.h1b ?? 0);
  const consumedKwh = importKwh + generatedKwh - exportKwh - immersionDivertedKwh;

  return {
    hour: record.hr ?? 0,
    minute: record.min ?? 0,
    importKwh,
    exportKwh,
    generatedKwh,
    consumedKwh: Math.max(0, consumedKwh),
    immersionDivertedKwh,
    immersionBoostedKwh,
    selfConsumptionRatio: selfConsumptionRatio(consumedKwh, importKwh),
  };
}

export async function fetchMinuteData(
  date: string,
  _timezone = 'Europe/Dublin',
): Promise<MinuteReading[]> {
  const url = `${V1_ENDPOINT}?date=${date}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error(`[v1-adapter] upstream error ${response.status} for date ${date}`);
      return [];
    }
    const raw = (await response.json()) as V1MinuteRecord[];
    if (!Array.isArray(raw)) {
      console.error(`[v1-adapter] unexpected response shape for date ${date}`);
      return [];
    }

    // The V1 proxy adjusts hour/minute for timezone and DST, but around BST
    // boundaries it can leave the calendar date fields on the previous local
    // day for an initial 00:00-00:59 block. Treat the returned clock-ordered
    // slice as authoritative for the requested day, and stop at the first wrap
    // back to an earlier clock minute.
    return normalizeRequestedDayRecords(raw).map((record) => mapRecord(record));
  } catch (err) {
    console.error(`[v1-adapter] fetch failed for date ${date}`, err);
    return [];
  }
}
