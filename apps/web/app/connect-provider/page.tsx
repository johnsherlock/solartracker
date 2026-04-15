'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SignOutButton } from '@/src/components/SignOutButton';
import { connectProvider } from './actions';

export default function ConnectProviderPage() {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/live" className="text-sm font-semibold text-slate-100 hover:text-slate-300 transition-colors">Solar Tracker</Link>
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
            <ConnectForm />
            <div className="mt-8 border-t border-slate-800 pt-6">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectForm() {
  const router = useRouter();
  const { update } = useSession();

  const [serialNumber, setSerialNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set('serialNumber', serialNumber);
    formData.set('password', password);

    try {
      const result = await connectProvider(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Refresh the session token so providerStatus updates before navigation.
      await update();
      router.push('/live');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label
          htmlFor="serialNumber"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5"
        >
          Serial number
        </label>
        <input
          id="serialNumber"
          name="serialNumber"
          type="text"
          placeholder="e.g. 12345678"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          disabled={submitting}
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5"
        >
          API key
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Your MyEnergi API key"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !serialNumber || !password}
        className="w-full rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {submitting ? 'Connecting…' : 'Connect MyEnergi'}
      </button>
    </form>
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

          <p className="font-semibold text-slate-300">Step 1 — Find your serial number</p>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside">
            <li>
              Sign in at{' '}
              <a
                href="https://myaccount.myenergi.com/login"
                target="myenergi-account"
                rel="noopener noreferrer"
                className="text-slate-300 font-medium underline underline-offset-2 hover:text-slate-100"
              >
                myaccount.myenergi.com
              </a>
            </li>
            <li>
              Go to{' '}
              <a
                href="https://myaccount.myenergi.com/location#products"
                target="myenergi-account"
                rel="noopener noreferrer"
                className="text-slate-300 underline underline-offset-2 hover:text-slate-100"
              >
                Location → myenergi Products
              </a>
            </li>
            <li>
              If you haven't yet registered your product, click the <span className="text-slate-300">Add another device</span> button and follow the instructions to add it to your account.
            </li>
            <li>
              Copy your serial number which is shown on the product card, labelled{' '}
              <span className="text-slate-300">SN</span> — it is an 8-digit number.
            </li>
          </ol>

          <p className="mt-5 font-semibold text-slate-300">Step 2 — Generate an API key</p>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside">
            <li>
              On the product card, click the{' '}
              <span className="text-slate-300">Advanced…</span> button
            </li>
            <li>
              Click <span className="text-slate-300">Generate new API key</span>
            </li>
            <li>
              Confirm when prompted
            </li>
            <li>
              Copy the key immediately —{' '}
              <span className="text-slate-300">it is only shown once</span>
            </li>
          </ol>

          <p className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300/80">
            Generating a new key replaces any previously generated key. If you have already
            connected Solar Tracker and regenerate your key, you will need to reconnect here.
          </p>
        </div>
      )}
    </div>
  );
}
