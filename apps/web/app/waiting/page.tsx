import { getSession } from '@/src/auth-helpers';
import { SignOutButton } from '@/src/components/SignOutButton';

export default async function WaitingPage() {
  const session = await getSession();
  const userEmail = session?.user?.email ?? '';

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">Solar Tracker</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">

        {/* Left — status heading */}
        <div className="flex flex-col justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Access pending
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            You&rsquo;re on the list
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            Your request has been received. We&rsquo;ll review it shortly and send an approval
            email to <span className="font-medium text-slate-200">{userEmail}</span> when your
            access is ready.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Beta access is manual and invite-only while we&rsquo;re in early testing. We appreciate
            your patience.
          </p>
        </div>

        {/* Right — next steps */}
        <div className="flex flex-col justify-center mt-12 lg:mt-0">
          <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-8 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              What happens next
            </p>

            <ol className="mt-4 space-y-4">
              {[
                { n: '1', text: 'We review your request — usually within a day or two.' },
                { n: '2', text: 'You receive an approval email when your access is ready.' },
                { n: '3', text: 'Sign back in using the same Google account you used today.' },
              ].map(({ n, text }) => (
                <li key={n} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 text-[10px] font-semibold text-slate-500">
                    {n}
                  </span>
                  {text}
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/80">
              Use <strong className="text-amber-200">the same Google account</strong> when you
              return — a different account starts a new access request.
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
