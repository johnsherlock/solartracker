import { redirect } from 'next/navigation';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';
import { loadLeaderboardContext } from '@/src/leaderboard/loader';
import { computeLeaderboard } from '@/src/leaderboard/ranking';
import { LeaderboardScreen } from './LeaderboardScreen';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leaderboard — PV Manager',
  description: 'All-time top days for each energy and value metric',
};

export default async function LeaderboardPage() {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/connect-provider');

  const ctx = await loadLeaderboardContext(installationId);
  if (!ctx) redirect('/connect-provider');

  const leaderboards = computeLeaderboard(ctx.series, ctx.repaymentSchedules, ctx.currency);

  return (
    <LeaderboardScreen
      leaderboards={leaderboards}
      currency={ctx.currency}
      hasHistory={ctx.series.some((d) => d.hasSummary)}
    />
  );
}
