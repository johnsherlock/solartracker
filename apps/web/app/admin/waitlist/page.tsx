import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/src/db/client';
import { waitlistEntries } from '@/src/db/schema';
import { desc } from 'drizzle-orm';
import { requireAdminSession } from '@/src/admin-auth';
import { logoutAdmin } from '@/app/solaris/actions';

export default async function AdminWaitlistPage() {
  await requireAdminSession();

  const entries = await db
    .select()
    .from(waitlistEntries)
    .orderBy(desc(waitlistEntries.createdAt));

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="text-sm font-semibold text-slate-100">Solar Tracker</span>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">Admin</span>
          <span className="text-slate-700">/</span>
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Users
            </Link>
            <span className="text-sm text-slate-300">Waitlist</span>
          </div>
          <div className="ml-auto">
            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-50">Waitlist</h1>
          <p className="mt-1 text-sm text-slate-400">{entries.length} {entries.length === 1 ? 'request' : 'requests'}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111b2b]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Email
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Requested
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-4 font-medium text-slate-100">{entry.email}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {entry.createdAt.toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-10 text-center text-slate-500">
                    No waitlist entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
