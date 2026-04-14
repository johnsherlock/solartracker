'use client';

import { signIn } from 'next-auth/react';

export default function SignInPage() {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">Solar Tracker</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">

        {/* Left — brand and product context */}
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Invite-only beta
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Understand what your solar is actually worth
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            Solar Tracker shows you exactly how much your installation is cutting your electricity
            bill — with tariff-aware savings, live monitoring, export value, and payback tracking.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Live generation, import, and export from your MyEnergi hub',
              'Tariff-aware cost and savings for any day or date range',
              'Payback progress and no-solar cost comparison',
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
              Privacy
            </p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">·</span>
                <span>Solar Tracker only ever <strong className="text-slate-300">reads</strong> from your MyEnergi account — it never changes settings or controls devices.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">·</span>
                <span>You can delete your account and all data at any time from Settings.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right — sign-in form */}
        <div className="flex flex-col justify-center mt-12 lg:mt-0">
          <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-8 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <h2 className="text-xl font-semibold text-slate-50">Sign in with Google</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Beta access is invite-only. You&rsquo;ll need a{' '}
              <span className="text-slate-300">MyEnergi hub</span>, serial number, and API key to
              connect after approval.
            </p>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/live' })}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-200 transition-colors cursor-pointer"
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            <p className="mt-6 text-center text-xs leading-relaxed text-slate-600">
              By continuing, you agree to our{' '}
              <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-slate-200">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-slate-200">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="currentColor" fillOpacity=".8" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="currentColor" fillOpacity=".8" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="currentColor" fillOpacity=".8" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="currentColor" fillOpacity=".8" />
    </svg>
  );
}
