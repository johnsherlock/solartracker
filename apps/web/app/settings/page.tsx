import Link from 'next/link';
import { CheckCircle2, Circle, Lock, ChevronRight, ArrowRight } from 'lucide-react';
import { loadSettingsCompletionState } from '@/src/settings/loader';

const SEED_INSTALLATION_ID = '00000000-0000-0000-0000-000000000002';

type SectionStatus = 'complete' | 'actionable' | 'coming-soon';

const SECTION_META = [
  {
    key: 'tariffs' as const,
    label: 'Tariffs',
    href: '/settings/tariffs',
    valueLine: 'Required for savings, cost, and payback calculations.',
    completeStatusLine: (providerName: string | null) => 'Active tariff configured',
    actionableCta: 'Set up tariff',
  },
  {
    key: 'provider' as const,
    label: 'Provider',
    href: '/settings/provider',
    valueLine: 'Required to fetch live and historical data.',
    completeStatusLine: (providerName: string | null) =>
      providerName ? `${formatProviderName(providerName)} · Connected` : 'Connected',
    actionableCta: 'Manage connection',
  },
  {
    key: 'finance' as const,
    label: 'Finance',
    href: '/settings/finance',
    valueLine: 'Unlocks the payback progress tracker.',
    completeStatusLine: () => 'Finance details configured',
    actionableCta: 'Set up finance',
  },
  {
    key: 'solar' as const,
    label: 'Solar details',
    href: '/settings/solar',
    valueLine: 'Unlocks solar efficiency and yield comparison views.',
    completeStatusLine: () => 'Array capacity set',
    actionableCta: 'Set up solar details',
  },
  {
    key: 'location' as const,
    label: 'Location',
    href: '/settings/location',
    valueLine: 'Improves solar yield context and local weather correlation.',
    completeStatusLine: () => 'Location configured',
    actionableCta: 'Set up location',
  },
  {
    key: 'notifications' as const,
    label: 'Notifications',
    href: '/settings/notifications',
    valueLine: 'Get notified before your tariff or contract expires.',
    completeStatusLine: () => '',
    actionableCta: null,
  },
] as const;

function formatProviderName(type: string): string {
  if (type === 'myenergi') return 'MyEnergi';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ---------------------------------------------------------------------------
// Setup card (desktop home view)
// ---------------------------------------------------------------------------

function SetupCard({
  label,
  href,
  status,
  statusLine,
  valueLine,
  cta,
}: {
  label: string;
  href: string;
  status: SectionStatus;
  statusLine: string;
  valueLine: string;
  cta: string | null;
}) {
  return (
    <div
      className={[
        'flex flex-col rounded-[20px] border p-5 shadow-[0_8px_30px_rgba(2,6,23,0.25)]',
        status === 'complete'
          ? 'border-emerald-800/30 bg-[#0d1f18]'
          : status === 'coming-soon'
            ? 'border-slate-800/60 bg-slate-900/40'
            : 'border-slate-800 bg-[#111b2b]',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        {status === 'complete' ? (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
        ) : status === 'coming-soon' ? (
          <Lock size={16} className="mt-0.5 shrink-0 text-slate-600" />
        ) : (
          <Circle size={16} className="mt-0.5 shrink-0 text-amber-400/70" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className={[
              'text-sm font-semibold',
              status === 'coming-soon' ? 'text-slate-500' : 'text-slate-100',
            ].join(' ')}
          >
            {label}
          </p>
          <p
            className={[
              'mt-0.5 text-xs',
              status === 'complete'
                ? 'text-emerald-400/80'
                : status === 'coming-soon'
                  ? 'text-slate-600'
                  : 'text-slate-500',
            ].join(' ')}
          >
            {status === 'coming-soon' ? 'Coming soon' : statusLine}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 leading-relaxed">{valueLine}</p>

      <div className="mt-4">
        {status === 'coming-soon' ? null : (
          <Link
            href={href}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              status === 'complete'
                ? 'border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100'
                : 'border border-indigo-500/50 bg-indigo-600/80 text-white hover:bg-indigo-600',
            ].join(' ')}
          >
            {status === 'complete' ? 'Edit' : cta}
            <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile section row
// ---------------------------------------------------------------------------

function MobileSectionRow({
  label,
  href,
  status,
  statusLine,
}: {
  label: string;
  href: string;
  status: SectionStatus;
  statusLine: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3.5 hover:bg-slate-800/60 transition-colors"
    >
      {status === 'complete' ? (
        <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
      ) : status === 'coming-soon' ? (
        <Lock size={16} className="shrink-0 text-slate-600" />
      ) : (
        <Circle size={16} className="shrink-0 text-amber-400/70" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={[
            'text-sm font-medium',
            status === 'coming-soon' ? 'text-slate-500' : 'text-slate-100',
          ].join(' ')}
        >
          {label}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {status === 'coming-soon' ? 'Coming soon' : statusLine}
        </p>
      </div>
      {status !== 'coming-soon' && (
        <ChevronRight size={14} className="shrink-0 text-slate-600" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({
  total,
  complete,
}: {
  total: number;
  complete: number;
}) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Setup progress
        </p>
        <p className="text-xs text-slate-400 tabular-nums">
          {complete} of {total} optional sections complete
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function resolveStatusLine(
  section: (typeof SECTION_META)[number],
  status: SectionStatus,
  providerName: string | null,
): string {
  if (status === 'complete') return section.completeStatusLine(providerName);
  if (status === 'coming-soon') return 'Coming soon';
  return 'Not set up';
}

export default async function SettingsHomePage() {
  const completion = await loadSettingsCompletionState(SEED_INSTALLATION_ID);

  return (
    <>
      <ProgressBar total={completion.totalActionable} complete={completion.totalComplete} />

      {/* Desktop: card grid (hidden on mobile — sidebar handles nav there) */}
      <div className="mt-8 hidden md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {SECTION_META.map((section) => {
          const status = completion[section.key] as SectionStatus;
          return (
            <SetupCard
              key={section.key}
              label={section.label}
              href={section.href}
              status={status}
              statusLine={resolveStatusLine(section, status, completion.providerName)}
              valueLine={section.valueLine}
              cta={section.actionableCta}
            />
          );
        })}
      </div>

      {/* Mobile: section list */}
      <div className="mt-6 flex flex-col gap-2 md:hidden">
        {SECTION_META.map((section) => {
          const status = completion[section.key] as SectionStatus;
          return (
            <MobileSectionRow
              key={section.key}
              label={section.label}
              href={section.href}
              status={status}
              statusLine={resolveStatusLine(section, status, completion.providerName)}
            />
          );
        })}
      </div>
    </>
  );
}
