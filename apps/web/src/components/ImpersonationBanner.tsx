import { cookies } from 'next/headers';
import { stopImpersonation } from '@/app/admin/users/actions';

export async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const email = cookieStore.get('impersonating_user_email')?.value;

  if (!email) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-4 py-2 text-sm font-medium text-slate-900 font-sans">
      <span>
        Viewing as <strong>{email}</strong>
      </span>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="rounded-full bg-slate-900/15 px-3 py-1 text-xs font-semibold hover:bg-slate-900/25 transition-colors"
        >
          Exit impersonation
        </button>
      </form>
    </div>
  );
}
