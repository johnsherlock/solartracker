import Link from 'next/link';
import { ChevronLeft, Settings, CheckCircle2, Circle, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { loadSettingsCompletionState } from '@/src/settings/loader';
import { redirect } from 'next/navigation';
import { resolveEffectiveInstallationId } from '@/src/installation-helpers';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { label: 'Tariffs', href: '/settings/tariffs', key: 'tariffs' as const },
  { label: 'Provider', href: '/settings/provider', key: 'provider' as const },
  { label: 'Finance', href: '/settings/finance', key: 'finance' as const },
  { label: 'Solar details', href: '/settings/solar', key: 'solar' as const },
  { label: 'Location', href: '/settings/location', key: 'location' as const },
  { label: 'Notifications', href: '/settings/notifications', key: 'notifications' as const },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];
type SectionStatus = 'complete' | 'actionable' | 'coming-soon';

function SidebarItem({
  label,
  href,
  status,
}: {
  label: string;
  href: string;
  status: SectionStatus;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors"
    >
      {status === 'complete' ? (
        <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
      ) : status === 'coming-soon' ? (
        <Lock size={14} className="shrink-0 text-slate-600" />
      ) : (
        <Circle size={14} className="shrink-0 text-amber-400/70" />
      )}
      <span className={status === 'coming-soon' ? 'text-slate-500' : ''}>{label}</span>
    </Link>
  );
}

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const installationId = await resolveEffectiveInstallationId();
  if (!installationId) redirect('/api/auth/signin');
  const completion = await loadSettingsCompletionState(installationId);
  const statusMap: Record<SectionKey, SectionStatus> = {
    tariffs: completion.tariffs,
    provider: completion.provider,
    finance: completion.finance,
    solar: completion.solar,
    location: completion.location,
    notifications: completion.notifications,
  };

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/live"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft size={14} />
              <span>Overview</span>
            </Link>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-100">Settings</span>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
            J
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto flex max-w-7xl gap-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-slate-800/60 md:pt-8 md:pb-12 md:px-4">
          <Link
            href="/settings"
            className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-300 transition-colors px-3"
          >
            Settings
          </Link>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((section) => (
              <SidebarItem
                key={section.key}
                label={section.label}
                href={section.href}
                status={statusMap[section.key]}
              />
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
