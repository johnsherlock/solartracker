'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Settings, Trophy } from 'lucide-react';

type SignedInHeaderProps = {
  /** Breadcrumb / page title area rendered on the left. */
  left: ReactNode;
  /** Optional page-specific items rendered to the right of the nav links. */
  actions?: ReactNode;
};

export function SignedInHeader({ left, actions }: SignedInHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">{left}</div>
        <div className="flex items-center gap-2">
          {actions}
          <Link
            href="/leaderboard"
            title="Leaderboard"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            <Trophy size={14} />
          </Link>
          <Link
            href="/settings"
            title="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
          >
            <Settings size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
