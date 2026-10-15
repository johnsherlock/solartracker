import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared public layout for the privacy policy and terms pages. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-slate-100 hover:text-white">
            Solar Tracker
          </Link>
          <nav className="flex gap-5 text-sm text-slate-400">
            <Link href="/privacy" className="hover:text-slate-200">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-200">Terms</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-slate-300">
          {children}
        </div>
        <p className="mt-12 border-t border-slate-800 pt-6 text-sm text-slate-500">
          Questions? Email{' '}
          <a href="mailto:support@solartracker.app" className="text-slate-300 underline underline-offset-2 hover:text-slate-100">
            support@solartracker.app
          </a>
          .
        </p>
      </main>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-slate-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
