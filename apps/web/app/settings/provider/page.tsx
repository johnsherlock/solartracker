import Link from 'next/link';
import { Plug, CheckCircle2, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { loadSettingsCompletionState } from '@/src/settings/loader';

export const dynamic = 'force-dynamic';

const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

function formatProviderName(type: string): string {
  if (type === 'myenergi') return 'MyEnergi';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatSyncTime(date: Date | null): string {
  if (!date) return 'Never';
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default async function ProviderPage() {
  const completion = await loadSettingsCompletionState(SEED_INSTALLATION_ID);

  const isConnected = completion.provider === 'complete';
  const providerDisplayName = completion.providerName
    ? formatProviderName(completion.providerName)
    : 'Provider';

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Plug size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Provider</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose">
        Manage your data provider connection. This is required to fetch live and historical
        energy data. You can update credentials here without going through the initial setup
        flow again.
      </p>

      <div className="mt-8 rounded-[20px] border border-slate-800 bg-[#111b2b] p-6">
        <div className="flex items-start gap-3">
          {isConnected ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">{providerDisplayName}</p>
            <p
              className={[
                'mt-0.5 text-xs',
                isConnected ? 'text-emerald-400/80' : 'text-amber-400/80',
              ].join(' ')}
            >
              {isConnected ? 'Connected' : 'Connection lost — update credentials to restore access'}
            </p>
          </div>
        </div>

        {isConnected && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={11} />
            <span>Last sync: {formatSyncTime(completion.providerLastSyncAt)}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            href="/connect-provider"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors"
          >
            Update credentials
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
