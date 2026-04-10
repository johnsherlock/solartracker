import {
  loadRangeInstallationContext,
  loadTariffVersionsForInstallation,
  loadFixedChargeVersionsForInstallation,
  loadDailySummaryRowsForRange,
  loadEarliestSummaryDate,
} from '@/src/range/loader';
import { allDatesInRange, computeRangeSummary } from '@/src/range/billing';
import type { RangeSummaryPayload } from '@/src/range/types';
import { RangeHistoryScreen } from './RangeHistoryScreen';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Range History — PV Manager',
  description: 'Energy, solar, and financial performance over time',
};

// ---------------------------------------------------------------------------
// Single-user seed path — no auth for the current local-dev slice.
// ---------------------------------------------------------------------------
const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

function getTodayLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function offsetDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type PageProps = {
  searchParams: Promise<{ mode?: string; from?: string; to?: string }>;
};

export default async function RangePage({ searchParams }: PageProps) {
  const { mode, from: initialFrom, to: initialTo } = await searchParams;

  const installationContext = await loadRangeInstallationContext(SEED_INSTALLATION_ID);
  const timezone = installationContext?.timezone ?? 'Europe/Dublin';
  const currency = installationContext?.currency ?? 'EUR';
  const today = getTodayLocalDate(timezone);

  const earliestDate = await loadEarliestSummaryDate(SEED_INSTALLATION_ID);

  // For "All" mode, load from the earliest known summary date.
  // Otherwise fall back to the default 365-day window.
  const windowStart =
    mode === 'all' && earliestDate ? earliestDate : offsetDays(today, -364);
  const windowEnd = today;

  try {
    const [tariffVersions, fixedCharges, summaryRows] = await Promise.all([
      loadTariffVersionsForInstallation(SEED_INSTALLATION_ID),
      loadFixedChargeVersionsForInstallation(SEED_INSTALLATION_ID),
      loadDailySummaryRowsForRange(SEED_INSTALLATION_ID, windowStart, windowEnd),
    ]);

    const allDates = allDatesInRange(windowStart, windowEnd);
    const { summary, series, health } = computeRangeSummary(
      summaryRows,
      allDates,
      tariffVersions,
      fixedCharges,
    );

    const payload: RangeSummaryPayload = {
      meta: {
        from: windowStart,
        to: windowEnd,
        timezone,
        currency,
        generatedAt: new Date().toISOString(),
        earliestDate,
      },
      summary,
      series,
      health,
    };

    return (
      <RangeHistoryScreen
        payload={payload}
        today={today}
        financeMode={installationContext?.financeMode ?? null}
        monthlyFinancePaymentAmount={installationContext?.monthlyFinancePaymentAmount ?? null}
        financeTermMonths={installationContext?.financeTermMonths ?? null}
        initialMode={mode ?? null}
        initialFrom={initialFrom ?? null}
        initialTo={initialTo ?? null}
        error={false}
      />
    );
  } catch (err) {
    console.error('[RangePage] Failed to load range data:', err);
    return (
      <RangeHistoryScreen
        payload={null}
        today={today}
        financeMode={null}
        monthlyFinancePaymentAmount={null}
        financeTermMonths={null}
        initialMode={mode ?? null}
        initialFrom={initialFrom ?? null}
        initialTo={initialTo ?? null}
        error={true}
      />
    );
  }
}
