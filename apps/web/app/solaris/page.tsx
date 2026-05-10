import { redirect } from 'next/navigation';
import { getAdminSession } from '@/src/admin-auth';
import { loginAdmin } from './actions';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (session) redirect('/admin/users');

  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-[linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#111b2b] p-8 shadow-xl">
        <h1 className="mb-6 text-lg font-semibold text-slate-100">Operator sign-in</h1>

        {error === 'invalid' && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Invalid username or password.
          </div>
        )}

        <form action={loginAdmin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-medium text-slate-400">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
