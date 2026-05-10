'use client';

import Link from 'next/link';
import { CalendarDays, ChevronLeft, Home, Trophy } from 'lucide-react';
import { SignedInHeader } from '@/src/components/SignedInHeader';
import { describeMetric } from '@/src/calendar/metrics';
import type { MetricLeaderboard } from '@/src/leaderboard/ranking';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type LeaderboardScreenProps = {
  leaderboards: MetricLeaderboard[];
  currency: string;
  hasHistory: boolean;
};

// ---------------------------------------------------------------------------
// Medal rendering
// ---------------------------------------------------------------------------

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

function RankBadge({ rank }: { rank: number }) {
  const medal = RANK_MEDALS[rank];
  if (medal) {
    return <span className="text-base leading-none select-none">{medal}</span>;
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-400">
      {rank}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ lb }: { lb: MetricLeaderboard }) {
  const { metric, entries, totalDaysWithData } = lb;
  const description = describeMetric(metric.id);

  return (
    <div className="rounded-[24px] border border-slate-800 bg-[#111b2b] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {metric.label}
      </p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 italic">No data recorded yet.</p>
      ) : (
        <>
          <div className="mt-4 divide-y divide-slate-800/60">
            {entries.map((entry) => (
              <Link
                key={entry.date}
                href={`/history/${entry.date}`}
                className="flex items-center gap-3 py-2.5 hover:bg-slate-800/30 -mx-2 px-2 rounded-xl transition-colors"
              >
                <RankBadge rank={entry.rank} />
                <span className="flex-1 text-sm text-slate-300">{entry.formattedDate}</span>
                <span className="font-mono text-sm font-semibold text-slate-100 shrink-0">
                  {entry.formattedValue}
                </span>
              </Link>
            ))}
          </div>
          {totalDaysWithData < 5 && (
            <p className="mt-3 text-[11px] text-slate-600">
              Based on {totalDaysWithData} day{totalDaysWithData === 1 ? '' : 's'} of history.
              Rankings will fill out as more data is recorded.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function LeaderboardScreen({
  leaderboards,
  hasHistory,
}: LeaderboardScreenProps) {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <SignedInHeader
        left={
          <>
            <Link
              href="/live"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft size={14} />
              <Home size={13} />
              <span className="hidden sm:inline">Overview</span>
            </Link>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-sm font-semibold text-slate-100">Leaderboard</span>
            </div>
          </>
        }
        actions={
          <Link
            href="/calendar"
            title="Calendar"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            <CalendarDays size={14} />
          </Link>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            All-time
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-50">Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Top five recorded days for each metric across all available history.
            Click any row to open that day's detail.
          </p>
        </div>

        {!hasHistory ? (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-slate-800 bg-[#111b2b] py-20 text-center">
            <Trophy size={28} className="mb-4 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No history recorded yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Rankings appear once daily summaries have been generated.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {leaderboards.map((lb) => (
              <MetricCard key={lb.metric.id} lb={lb} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
