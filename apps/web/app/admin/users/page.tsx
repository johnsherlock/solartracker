import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/src/db/client';
import { users } from '@/src/db/schema';
import { desc } from 'drizzle-orm';
import { approveUser, startImpersonation } from './actions';
import { getSession } from '@/src/auth-helpers';
import { UserRole, UserStatus } from '@/src/user-constants';

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== UserRole.Admin) redirect('/live');

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      approvedAt: users.approvedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/live" className="text-sm font-semibold text-slate-100 hover:text-slate-300 transition-colors">Solar Tracker</Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">Admin</span>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-400">Users</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-50">Users</h1>
          <p className="mt-1 text-sm text-slate-400">{allUsers.length} registered</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111b2b]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  User
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Role
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Registered
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {allUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-100">{user.displayName ?? '—'}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    {user.createdAt.toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {user.status === UserStatus.AwaitingApproval && (
                        <form action={approveUser.bind(null, user.id)}>
                          <button
                            type="submit"
                            className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            Approve
                          </button>
                        </form>
                      )}
                      {user.status === UserStatus.Approved && user.role !== UserRole.Admin && (
                        <form action={startImpersonation.bind(null, user.id)}>
                          <button
                            type="submit"
                            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
                          >
                            View as user
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {allUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No users yet.
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    [UserStatus.AwaitingApproval]: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    [UserStatus.Approved]: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    [UserStatus.Suspended]: 'bg-red-500/10 border-red-500/30 text-red-400',
  };
  const labels: Record<string, string> = {
    [UserStatus.AwaitingApproval]: 'Pending',
    [UserStatus.Approved]: 'Approved',
    [UserStatus.Suspended]: 'Suspended',
  };
  const cls = styles[status] ?? 'bg-slate-700/30 border-slate-700 text-slate-400';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
      role === UserRole.Admin
        ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
        : 'bg-slate-700/20 border-slate-700 text-slate-500'
    }`}>
      {role}
    </span>
  );
}
