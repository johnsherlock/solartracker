/**
 * Low-level MyEnergi API client.
 *
 * Computes the correct UTC query window for a requested local day and
 * fetches the raw Eddi interval records via HTTP Digest Auth.
 */

import { digestGet } from './auth';
import type { EddiRecord, MyEnergiCredentials } from './types';

const MYENERGI_ENDPOINT = 'https://director.myenergi.net';

// Fetch 1500 minutes (25 hours) to fully cover DST fall-back days where a
// local day lasts 25 hours. Records outside the requested local day are
// filtered by the adapter.
const QUERY_MINUTES = 1500;

/**
 * Find the UTC epoch of local midnight for the requested date in the given
 * timezone. Scans backwards from UTC noon on the same calendar date to find
 * the first UTC millisecond whose local representation is 00:00 on that date.
 */
export function localMidnightUtc(localDate: string, timezone: string): number {
  const [year, month, day] = localDate.split('-').map(Number);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function getLocalParts(ts: number) {
    const parts = formatter.formatToParts(new Date(ts));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
  }

  // Start scanning from UTC noon on the calendar date (UTC noon is a safe
  // anchor that will always be within a few hours of local midnight for any
  // UTC-offset timezone).
  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);

  // Walk backwards minute-by-minute until we cross local midnight
  for (let delta = -13 * 60; delta <= 14 * 60; delta++) {
    const ts = utcNoon + delta * 60_000;
    const local = getLocalParts(ts);
    if (
      local.year === year &&
      local.month === month &&
      local.day === day &&
      local.hour === 0 &&
      local.minute === 0
    ) {
      return ts;
    }
  }

  throw new Error(`[myenergi-client] Could not determine local midnight for ${localDate} in ${timezone}`);
}

/**
 * Build the cgi-jday-E URL for a given UTC start epoch and query duration.
 *
 * Format: /cgi-jday-E{serial}-{YYYY-MM-DD}-{hour}-{minute}-{minutes}
 * where the date, hour, and minute are the UTC start of the window.
 */
function buildUrl(serialNumber: string, utcStartMs: number, minutes: number): string {
  const d = new Date(utcStartMs);
  const utcYear = d.getUTCFullYear();
  const utcMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(d.getUTCDate()).padStart(2, '0');
  const utcHour = d.getUTCHours();
  const utcMinute = d.getUTCMinutes();
  const isoDate = `${utcYear}-${utcMonth}-${utcDay}`;

  return `${MYENERGI_ENDPOINT}/cgi-jday-E${serialNumber}-${isoDate}-${utcHour}-${utcMinute}-${minutes}`;
}

export type FetchDayResult =
  | { ok: true; records: EddiRecord[] }
  | { ok: false; kind: 'auth-failure' | 'empty-day' | 'upstream-error'; detail: string };

/**
 * Fetch raw Eddi interval records for one local calendar day.
 *
 * @param localDate  Requested local date in YYYY-MM-DD format
 * @param timezone   IANA timezone for the installation (e.g. "Europe/Dublin")
 * @param credentials  MyEnergi serial number and password
 */
export async function fetchDayRecords(
  localDate: string,
  timezone: string,
  credentials: MyEnergiCredentials,
): Promise<FetchDayResult> {
  const utcStartMs = localMidnightUtc(localDate, timezone);
  const url = buildUrl(credentials.serialNumber, utcStartMs, QUERY_MINUTES);

  let response: Response;
  try {
    response = await digestGet(url, credentials.serialNumber, credentials.password);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[myenergi-client] Fetch failed for ${localDate}: ${detail}`);
    return { ok: false, kind: 'upstream-error', detail };
  }

  if (response.status === 401) {
    return { ok: false, kind: 'auth-failure', detail: 'Invalid MyEnergi credentials' };
  }

  if (!response.ok) {
    const detail = `HTTP ${response.status}`;
    console.error(`[myenergi-client] Upstream error for ${localDate}: ${detail}`);
    return { ok: false, kind: 'upstream-error', detail };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, kind: 'upstream-error', detail: `JSON parse error: ${detail}` };
  }

  if (typeof body !== 'object' || body === null) {
    return { ok: false, kind: 'upstream-error', detail: 'Unexpected response shape' };
  }

  const key = `U${credentials.serialNumber}`;
  const records = (body as Record<string, unknown>)[key];

  if (!Array.isArray(records)) {
    return { ok: false, kind: 'upstream-error', detail: `Missing or invalid key "${key}" in response` };
  }

  if (records.length === 0) {
    return { ok: false, kind: 'empty-day', detail: `No records returned for ${localDate}` };
  }

  return { ok: true, records: records as EddiRecord[] };
}
