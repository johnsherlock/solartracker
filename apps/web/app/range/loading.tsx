export default function RangeLoading() {
  return (
    <div className="min-h-screen font-sans text-slate-100 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.06),_transparent_30%),linear-gradient(180deg,#050b14_0%,#0b1220_100%)] cursor-wait">
      {/* Green shimmer bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 overflow-hidden">
        <div
          className="h-full w-full animate-shimmer"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #22c55e 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      {/* Nav bar skeleton */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#101826]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 animate-pulse rounded-full bg-slate-800" />
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-800" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-800" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-800" />
          </div>
        </div>
      </header>

      {/* Period selector skeleton */}
      <div className="sticky top-14 z-30 border-b border-slate-800 bg-[#0c1422]/90">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-800" />
            <div className="h-8 w-44 animate-pulse rounded-full bg-slate-800" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-800" />
          </div>
        </div>
      </div>

      {/* Content skeletons */}
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Hero card skeleton */}
        <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
          <div className="mb-4 h-6 w-32 animate-pulse rounded-full bg-slate-800" />
          <div className="mb-2 h-10 w-48 animate-pulse rounded-full bg-slate-800" />
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-800" />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4">
            <div className="space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-full bg-slate-800" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-800" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-800" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Bill impact skeleton */}
        <div className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
          <div className="mb-4 h-3 w-24 animate-pulse rounded-full bg-slate-800" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-800" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Chart card skeletons */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[28px] border border-slate-800 bg-[#111b2b] p-5">
            <div className="mb-4 h-3 w-32 animate-pulse rounded-full bg-slate-800" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-800/60" />
          </div>
        ))}
      </main>
    </div>
  );
}
