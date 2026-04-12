export default function SuspendedPage() {
  // Auth middleware routes suspended users here instead of the app.
  // A suspension-management UI is explicitly deferred (decision 0006 §11).

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">Solar Tracker</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Account status
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-50 sm:text-5xl">
          Access paused
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
          Your access to Solar Tracker has been paused. Get in touch if you have questions.
        </p>

        <div className="mt-10 w-full max-w-sm rounded-[28px] border border-slate-800 bg-[#111b2b] p-8 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
          <p className="text-sm font-semibold text-slate-300">Contact us</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Email us and we&rsquo;ll get back to you.
          </p>
          <a
            href="mailto:support@solartracker.app"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-600 hover:text-white"
          >
            support@solartracker.app
          </a>

          <div className="mt-8 border-t border-slate-800 pt-6">
            {/* Sign-out — placeholder until NextAuth is wired (P-040) */}
            <a href="#" className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-300">
              Sign out
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
