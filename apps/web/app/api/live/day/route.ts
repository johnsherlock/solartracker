import { NextRequest } from 'next/server';
import { buildDayDetail } from '../../../../src/live/normalizer';
import { loadInstallationContext, loadProviderConnection } from '../../../../src/live/loader';
import { fetchDayRecords } from '../../../../src/providers/myenergi/client';
import { normaliseEddiRecords } from '../../../../src/providers/myenergi/adapter';
import { resolveMyEnergiCredentials } from '../../../../src/providers/myenergi/credentials';

// Single-user seed path — no auth or user selection for the local-dev slice.
const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateParam = searchParams.get('date');

  const installationContext = await loadInstallationContext(SEED_INSTALLATION_ID);
  const timezone = installationContext?.timezone ?? 'Europe/Dublin';
  const date = dateParam ?? todayInTimezone(timezone);

  if (!DATE_PATTERN.test(date)) {
    return Response.json({ error: 'Invalid date format. Expected YYYY-MM-DD.' }, { status: 400 });
  }

  const providerConnection = await loadProviderConnection(SEED_INSTALLATION_ID);
  const credentials = resolveMyEnergiCredentials(providerConnection?.credentialRef);

  if (!credentials) {
    return Response.json(
      { error: 'No valid provider credentials configured for this installation.' },
      { status: 503 },
    );
  }

  const fetchedAt = new Date().toISOString();
  const fetchResult = await fetchDayRecords(date, timezone, credentials);

  if (!fetchResult.ok) {
    if (fetchResult.kind === 'auth-failure') {
      return Response.json({ error: 'Provider authentication failed.' }, { status: 502 });
    }
    if (fetchResult.kind === 'empty-day') {
      const minutes = normaliseEddiRecords([], date, timezone);
      const result = buildDayDetail(date, minutes, fetchedAt, timezone, 'myenergi');
      return Response.json(result);
    }
    return Response.json({ error: 'Provider unavailable.' }, { status: 502 });
  }

  const minutes = normaliseEddiRecords(fetchResult.records, date, timezone);
  const result = buildDayDetail(date, minutes, fetchedAt, timezone, 'myenergi');

  return Response.json(result);
}
