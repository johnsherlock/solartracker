'use client';

import { useState } from 'react';
import { SignOutButton } from '@/src/components/SignOutButton';

export default function ConnectProviderPage() {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">Solar Tracker</span>
          <span className="mx-2 text-slate-700">/</span>
          <span className="text-sm text-slate-400">Setup</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">

        {/* Left — context */}
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Required setup
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Connect your MyEnergi account
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            Solar Tracker reads live and historical data directly from your MyEnergi hub.
            This is the only required step before you can use the app — everything else can
            be set up later.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Read-only access — Solar Tracker never changes your settings or controls your devices',
              'Your credentials are stored securely server-side and never exposed in the browser',
              'You can reconnect or disconnect at any time from Settings',
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                {point}
              </li>
            ))}
          </ul>

          <CredentialsHelp />
        </div>

        {/* Right — form */}
        <div className="flex flex-col justify-center mt-12 lg:mt-0">
          <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-8 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              MyEnergi credentials
            </p>

            {/* Credentials form placeholder — built in P-038 / U-048 */}
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                  Serial number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 12345678"
                  disabled
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-500 placeholder-slate-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                  API key
                </label>
                <input
                  type="password"
                  placeholder="Your MyEnergi API key"
                  disabled
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-500 placeholder-slate-700 cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                disabled
                className="w-full rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 opacity-40 cursor-not-allowed"
              >
                Connect MyEnergi
              </button>
              <p className="text-center text-xs text-slate-600">
                Connection form will be enabled in the next release.
              </p>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-6">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CredentialsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
      >
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        How do I find my MyEnergi credentials?
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm leading-relaxed text-slate-400">
          <p className="font-semibold text-slate-300">Serial number</p>
          <p className="mt-1">
            Your 8-digit serial number is printed on the sticker on the side of your MyEnergi
            hub (Zappi, Harvi, or Eddi). It is also shown in the MyEnergi app under{' '}
            <em>Settings → Hub</em>.
          </p>
          <p className="mt-4 font-semibold text-slate-300">API key</p>
          <p className="mt-1">
            Open the MyEnergi app, go to <em>Settings → Advanced → API</em>, and tap{' '}
            <em>Generate API key</em>. Copy the key — it will not be displayed again. If you
            have already generated one, you can regenerate it from the same screen.
          </p>
        </div>
      )}
    </div>
  );
}
