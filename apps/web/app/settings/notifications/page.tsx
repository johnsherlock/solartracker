import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Bell size={18} className="text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-100">Notifications</h1>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed max-w-prose">
        Set up contract renewal reminders, tariff validity alerts, and other notification
        preferences. You will be notified before your tariff or contract expires.
      </p>

      <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center">
        <Bell size={28} className="mx-auto mb-4 text-slate-700" />
        <p className="text-sm font-semibold text-slate-300">Coming soon</p>
        <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto">
          Notification preferences are deferred from this version of Settings.
          Contract and tariff reminder alerts will appear here in a future update.
        </p>
      </div>
    </div>
  );
}
