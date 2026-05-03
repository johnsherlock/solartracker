import type { NextRequest } from 'next/server';
import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadDailyPricedRollupsForRange,
  loadEarliestIntervalDate,
} from '../../../src/range/loader';
import { allDatesInRange, computeRangeSummaryFromRollups } from '../../../src/range/billing';
import type { RangeSummaryPayload } from '../../../src/range/types';
import { resolveEffectiveInstallationId } from '../../../src/installation-helpers';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_PATTERN.test(s)) return false;
  const [year, month, day] = s.split('-').map(Number);
  // Round-trip validation: JS normalises overflow dates (e.g. Feb 31 → Mar 3),
  // so we verify the parsed components match the original string.
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return Response.json(
      { error: 'Missing required query parameters: from, to (YYYY-MM-DD).' },
      { status: 400 },
    );
  }

  if (!isValidDate(from) || !isValidDate(to)) {
    return Response.json(
      { error: 'Invalid date format. Expected YYYY-MM-DD for both from and to.' },
      { status: 400 },
    );
  }

  if (from > to) {
    return Response.json(
      { error: 'from must be on or before to.' },
      { status: 400 },
    );
  }

  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const installationContext = await loadRangeInstallationContext(installationId);
  if (!installationContext) {
    return Response.json(
      { error: 'Installation not found.' },
      { status: 404 },
    );
  }

  const timezone = installationContext.timezone;

  const [tariffVersions, rollups, earliestDate] = await Promise.all([
    loadTariffVersionsForInstallation(installationId),
    loadDailyPricedRollupsForRange(installationId, from, to),
    loadEarliestIntervalDate(installationId, timezone),
  ]);

  const allDates = allDatesInRange(from, to);
  const { summary, series, health } = computeRangeSummaryFromRollups(
    rollups,
    allDates,
    timezone,
    tariffVersions,
  );

  const payload: RangeSummaryPayload = {
    meta: {
      from,
      to,
      timezone: installationContext.timezone,
      currency: installationContext.currency,
      generatedAt: new Date().toISOString(),
      earliestDate,
    },
    summary,
    series,
    health,
  };

  return Response.json(payload);
}
