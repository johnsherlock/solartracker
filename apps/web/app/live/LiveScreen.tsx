'use client';

import { use, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  RefreshCw,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  Clock,
  Zap,
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Activity,
  ChevronLeft,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

// ─── Mock data ────────────────────────────────────────────────────────────────

function generateChartData(state: ScreenState) {
  const labels = ['11:00', '11:05', '11:10', '11:15', '11:20', '11:25', '11:30'];
  const base = [
    { gen: 2.1, cons: 0.9, imp: 0.1, exp: 1.2 },
    { gen: 2.3, cons: 1.0, imp: 0.0, exp: 1.3 },
    { gen: 2.4, cons: 0.8, imp: 0.0, exp: 1.6 },
    { gen: 2.2, cons: 1.1, imp: 0.2, exp: 1.1 },
    { gen: 2.1, cons: 0.9, imp: 0.1, exp: 1.2 },
    { gen: 2.3, cons: 1.0, imp: 0.0, exp: 1.3 },
    { gen: 2.1, cons: 0.9, imp: 0.1, exp: 1.2 },
  ];
  if (state === 'stale' || state === 'warning') {
    return labels.slice(0, 5).map((t, i) => ({
      time: t,
      generation: base[i].gen,
      consumption: base[i].cons,
      import: base[i].imp,
      export: base[i].exp,
    }));
  }
  if (state === 'disconnected') return [];
  return labels.map((t, i) => ({
    time: t,
    generation: base[i].gen,
    consumption: base[i].cons,
    import: base[i].imp,
    export: base[i].exp,
  }));
}

// ─── Design tokens (from ui-ux-pro-max skill) ─────────────────────────────────
// Real-Time Monitoring + Dark Mode hybrid
// Fira Code for KPI values, Fira Sans for body
// Pulsing live dot, minimal glow accents, border-based card separation

const CHART_COLORS = {
  generation:  '#fbbf24', // amber-400 — solar
  consumption: '#64748b', // slate-500
  import:      '#475569', // slate-600 — deliberately dim
  export:      '#34d399', // emerald-400 — positive
};

// ─── Prototype switcher ────────────────────────────────────────────────────────

function PrototypeSwitcher({
  current,
  onChange,
}: {
  current: ScreenState;
  onChange: (s: ScreenState) => void;
}) {
  const states: { id: ScreenState; label: string }[] = [
    { id: 'healthy',      label: 'Healthy' },
    { id: 'stale',        label: 'Stale' },
    { id: 'warning',      label: 'Warning' },
    { id: 'disconnected', label: 'Disconnected' },
  ];
  return (
    <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center gap-3 text-xs flex-wrap">
      <span className="text-slate-600 uppercase tracking-widest text-[10px] font-medium">
        Prototype state:
      </span>
      {states.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`px-3 py-1 rounded-full border transition-all duration-150 font-medium cursor-pointer ${
            current === s.id
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
              : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── Trust badge ──────────────────────────────────────────────────────────────
// Skill: status colours — live #22C55E, warning #F97316, critical #DC2626
// With shape/icon alongside colour (not colour-only) per WCAG

function TrustBadge({ state }: { state: ScreenState }) {
  const configs: Record<
    ScreenState,
    { icon: React.ReactNode; label: string; dotClass: string; pillClass: string }
  > = {
    healthy: {
      icon: <CheckCircle2 size={12} />,
      label: 'Updated 12 seconds ago',
      dotClass: 'bg-emerald-400 animate-live-pulse',
      pillClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
    stale: {
      icon: <Clock size={12} />,
      label: 'Last seen 18 minutes ago',
      dotClass: 'bg-orange-400',
      pillClass: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    },
    warning: {
      icon: <AlertTriangle size={12} />,
      label: 'Suspicious data — 3 min ago',
      dotClass: 'bg-orange-400',
      pillClass: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    },
    disconnected: {
      icon: <WifiOff size={12} />,
      label: 'Provider disconnected',
      dotClass: 'bg-red-500',
      pillClass: 'bg-red-500/10 border-red-500/30 text-red-400',
    },
  };
  const { icon, label, dotClass, pillClass } = configs[state];
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${pillClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      {icon}
      {label}
    </span>
  );
}

// ─── Warning banner ────────────────────────────────────────────────────────────
// Skill: alert colours, calm tone, shape + colour combined, one CTA

function WarningBanner({
  state,
  onAction,
}: {
  state: ScreenState;
  onAction: () => void;
}) {
  if (state === 'healthy') return null;

  const configs: Partial<Record<ScreenState, {
    icon: React.ReactNode;
    msg: string;
    cta: string;
    cls: string;
  }>> = {
    stale: {
      icon: <Clock size={14} className="shrink-0 mt-px" />,
      msg: 'Live data is delayed. Your system was last seen 18 minutes ago.',
      cta: 'Review Data Health',
      cls: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    },
    warning: {
      icon: <AlertTriangle size={14} className="shrink-0 mt-px" />,
      msg: 'Some readings look unusually high. This may be a provider reporting issue.',
      cta: 'Review Data Health',
      cls: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    },
    disconnected: {
      icon: <WifiOff size={14} className="shrink-0 mt-px" />,
      msg: 'MyEnergi is not connected. Credentials may have expired.',
      cta: 'Reconnect',
      cls: 'bg-red-500/10 border-red-500/20 text-red-300',
    },
  };

  const cfg = configs[state];
  if (!cfg) return null;

  return (
    <div className={`flex items-start gap-3 px-4 sm:px-6 py-2.5 text-xs border-b ${cfg.cls}`}>
      {cfg.icon}
      <span className="flex-1">{cfg.msg}</span>
      <button
        onClick={onAction}
        className="shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
      >
        {cfg.cta} →
      </button>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
// Skill: Fira Code for KPI values (tabular, monospaced)
// Skill: border-based card separation on dark backgrounds
// Skill: minimal glow ring for active state (box-shadow at low opacity)
// Skill: desaturate + dim for stale state

type MetricCardProps = {
  label: string;
  value: string;
  unit: string;
  caption: string;
  icon: React.ReactNode;
  accentClass: string;
  glowColor: string;
  stale?: boolean;
};

function MetricCard({
  label,
  value,
  unit,
  caption,
  icon,
  accentClass,
  glowColor,
  stale,
}: MetricCardProps) {
  return (
    <div
      className={`
        relative rounded-xl border p-4 flex flex-col gap-1 transition-all duration-300
        ${stale
          ? 'bg-[#1e293b]/50 border-slate-700/40'
          : 'bg-[#1e293b] border-slate-700/60 hover:border-slate-600/80'
        }
      `}
      style={
        !stale
          ? { boxShadow: `0 0 0 1px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.04)` }
          : undefined
      }
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <span className={`${stale ? 'text-slate-600' : accentClass} transition-colors`}>
          {icon}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        {/* Skill: Fira Code for KPI values — tabular, monospaced */}
        <span
          className={`font-mono text-3xl font-bold tabular-nums leading-none transition-all ${
            stale ? 'text-slate-600' : 'text-slate-100'
          }`}
        >
          {value}
        </span>
        <span className={`text-sm font-mono ${stale ? 'text-slate-700' : 'text-slate-500'}`}>
          {unit}
        </span>
        {stale && <Clock size={11} className="text-orange-600 mb-0.5" />}
      </div>

      <span className={`text-[11px] ${stale ? 'text-slate-700' : 'text-slate-500'}`}>
        {caption}
      </span>
    </div>
  );
}

// ─── Coverage bar ──────────────────────────────────────────────────────────────
// Skill: progress bar style from bullet chart guidance
// Solar gold fill, slate dim for grid portion

function CoverageBar({ solarPct, stale }: { solarPct: number; stale?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-[#1e293b] transition-opacity ${
      stale ? 'border-slate-700/30 opacity-60' : 'border-slate-700/60'
    }`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Solar
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          Grid
          <span className="w-2 h-2 rounded-full bg-slate-600" />
        </div>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-700"
          style={{
            width: `${solarPct}%`,
            boxShadow: stale ? 'none' : '0 0 8px rgba(251,191,36,0.4)',
          }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        <span className={`font-semibold font-mono ${stale ? 'text-slate-500' : 'text-amber-400'}`}>
          {solarPct}%
        </span>{' '}
        of your home is running on solar right now
        {stale && <span className="ml-1 text-orange-600">(last known)</span>}
      </p>
    </div>
  );
}

// ─── Custom chart tooltip ──────────────────────────────────────────────────────

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] border border-slate-700 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="text-slate-400 font-mono mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-slate-300 capitalize">{entry.name}</span>
          <span className="font-mono font-semibold text-slate-100 ml-auto pl-4">
            {entry.value.toFixed(2)} kW
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Live trend chart ──────────────────────────────────────────────────────────
// Skill: Streaming Area Chart — fading opacity on history, current pulse
// Skill: dark chart bg, very subtle grid lines (not competing with data)
// Skill: legend-interactive — toggleable series

function LiveTrendChart({
  data,
  stale,
}: {
  data: ReturnType<typeof generateChartData>;
  stale?: boolean;
}) {
  const [resolution, setResolution] = useState<'5min' | '15min'>('5min');

  return (
    <div className={`rounded-xl border bg-[#1e293b] overflow-hidden transition-all ${
      stale ? 'border-orange-500/20' : 'border-slate-700/60'
    }`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <Activity size={14} className={stale ? 'text-orange-500' : 'text-slate-400'} />
          <h3 className="text-sm font-semibold text-slate-200">
            Live trend
          </h3>
          <span className="text-xs text-slate-500">(last 30 min)</span>
        </div>
        {/* Skill: time-resolution toggle — compact segmented control in chart header */}
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
          {(['5min', '15min'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResolution(r)}
              className={`px-2.5 py-1 font-mono transition-colors cursor-pointer ${
                resolution === r
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {stale && data.length > 0 && (
        <div className="mx-4 mt-3 flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-lg">
          <Clock size={11} />
          Data delayed — shown up to last available point
        </div>
      )}

      <div className="px-2 py-3">
        {data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-600 bg-slate-800/40 rounded-lg mx-2">
            No live data available
          </div>
        ) : (
          /* Skill: desaturate for stale state */
          <div className={stale ? 'opacity-50 saturate-0' : ''}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={data}
                margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
              >
                <defs>
                  {Object.entries(CHART_COLORS).map(([key, color]) => (
                    <linearGradient
                      key={key}
                      id={`darkGrad-${key}`}
                      x1="0" y1="0" x2="0" y2="1"
                    >
                      {/* Skill: fading opacity for streaming history */}
                      <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#475569', fontFamily: 'Fira Code, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#475569', fontFamily: 'Fira Code, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}kW`}
                  /* Skill: subtle grid lines, not dominant */
                />
                {/* Skill: dark tooltip, all series at hover point */}
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{
                    fontSize: 11,
                    paddingTop: 10,
                    fontFamily: 'Fira Sans, system-ui, sans-serif',
                    color: '#64748b',
                  }}
                  formatter={(v) => (
                    <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>
                      {String(v)}
                    </span>
                  )}
                />
                {Object.entries(CHART_COLORS).map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    fill={`url(#darkGrad-${key})`}
                    strokeWidth={key === 'import' ? 1 : 1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Today totals ──────────────────────────────────────────────────────────────

function TodayTotals({
  stale,
  onViewDay,
}: {
  stale?: boolean;
  onViewDay: () => void;
}) {
  const rows = [
    { label: 'Generated', value: '14.2', unit: 'kWh', color: 'text-amber-400' },
    { label: 'Consumed',  value: '9.8',  unit: 'kWh', color: 'text-slate-400' },
    { label: 'Imported',  value: '1.6',  unit: 'kWh', color: 'text-slate-600' },
    { label: 'Exported',  value: '4.4',  unit: 'kWh', color: 'text-emerald-400' },
  ];
  return (
    <div className="rounded-xl border border-slate-700/60 bg-[#1e293b] p-4 flex flex-col">
      <h3 className="text-sm font-semibold text-slate-200 mb-0.5">
        Today so far
      </h3>
      {stale && (
        <p className="text-[11px] text-orange-400 mb-2">May be incomplete</p>
      )}
      <div className="space-y-2.5 mt-2 flex-1">
        {rows.map(({ label, value, unit, color }) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`font-mono text-sm font-semibold tabular-nums ${
              stale ? 'text-slate-600' : color
            }`}>
              {value}
              <span className="text-slate-600 font-normal ml-0.5 text-[11px]">{unit}</span>
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onViewDay}
        className="mt-4 flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
      >
        View full day <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Notes panel ──────────────────────────────────────────────────────────────

function NotesPanel({
  state,
  showEfficiency,
  onDataHealth,
}: {
  state: ScreenState;
  showEfficiency: boolean;
  onDataHealth: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-[#1e293b] p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-200">Notes</h3>

      {state === 'healthy' && (
        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2.5">
          <Activity size={12} className="mt-px shrink-0 text-slate-600" />
          Today&apos;s totals are still accumulating — check back after midnight for the full day summary.
        </div>
      )}

      {(state === 'stale' || state === 'warning') && (
        <div className="flex items-start gap-2 text-xs text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          <div>
            <span className="font-semibold block mb-0.5">
              {state === 'stale' ? 'Data delayed' : 'Suspicious readings'}
            </span>
            {state === 'stale'
              ? 'Live feed has not updated in 18 minutes. Historical summaries remain accurate.'
              : 'One or more interval readings appear unusually high. Provider reporting may be at fault.'
            }
            <button
              onClick={onDataHealth}
              className="block mt-1.5 font-semibold underline underline-offset-2 text-orange-400 cursor-pointer"
            >
              Review Data Health →
            </button>
          </div>
        </div>
      )}

      {showEfficiency && state !== 'disconnected' && (
        <div className="text-xs text-slate-500 flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
          <span>Efficiency</span>
          <span className="font-mono font-semibold text-slate-300">78%
            <span className="font-normal text-slate-600 ml-1">of 18 kWp max</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Disconnected state ────────────────────────────────────────────────────────
// Skill: single primary CTA, destructive colour, error recovery path

function DisconnectedState({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center py-20 px-4">
      <div className="max-w-xs text-center space-y-5">
        <div className="relative mx-auto w-14 h-14">
          <div className="absolute inset-0 rounded-full bg-red-500/10 border border-red-500/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <WifiOff size={22} className="text-red-400" />
          </div>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100 mb-1.5">
            MyEnergi is not connected
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your provider credentials may have expired. Reconnect to resume live monitoring.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReconnect}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-400 rounded-lg transition-colors cursor-pointer"
          >
            Reconnect
          </button>
          <button className="px-4 py-2 text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer">
            Troubleshoot
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nav bar ──────────────────────────────────────────────────────────────────
// Skill: auto-refresh indicator, user avatar, "Live" label prominent

function NavBar({
  state,
  onHome,
}: {
  state: ScreenState;
  onHome: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 h-14 bg-[#1e293b] border-b border-slate-700/60">
      <div className="flex items-center gap-3">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          <Home size={13} />
          <span className="hidden sm:inline">Overview</span>
        </button>
        <span className="text-slate-700">/</span>
        <div className="flex items-center gap-2">
          {/* Skill: pulsing live dot — --pulse-animation: pulse 2s infinite */}
          {state === 'healthy' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-live-pulse" />
          )}
          <span className="text-sm font-semibold text-slate-100">Live</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Skill: auto-refresh indicator for realtime monitoring */}
        {state === 'healthy' && (
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <RefreshCw
              size={11}
              className="text-emerald-500"
              style={{ animation: 'spin 3s linear infinite' }}
            />
            Auto-refreshing
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
          J
        </div>
      </div>
    </header>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export function LiveScreen({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const params = use(searchParams);
  const initialState = (params.state as ScreenState) ?? 'healthy';
  const [screenState, setScreenState] = useState<ScreenState>(initialState);
  const [toastMsg, setToastMsg]       = useState<string | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }

  const chartData  = generateChartData(screenState);
  const isStale    = screenState === 'stale' || screenState === 'warning';
  const isDiscon   = screenState === 'disconnected';

  return (
    /* Skill: deep slate-900 page bg — not pure OLED black, as requested */
    <div className="min-h-screen bg-[#0f172a] font-sans" style={{ colorScheme: 'dark' }}>

      {/* Prototype chrome */}
      <PrototypeSwitcher current={screenState} onChange={setScreenState} />

      <div className="flex flex-col min-h-[calc(100vh-40px)]">
        <NavBar state={screenState} onHome={() => toast('→ Overview (not yet built)')} />

        <WarningBanner
          state={screenState}
          onAction={() => toast(isDiscon ? '→ Provider reconnect (not yet built)' : '→ Data Health (not yet built)')}
        />

        {/* Trust strip */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-[#0f172a]/80 flex items-center gap-3">
          <TrustBadge state={screenState} />
        </div>

        <main className="flex-1 px-4 sm:px-6 py-5 max-w-5xl w-full mx-auto space-y-4">
          {isDiscon ? (
            <DisconnectedState onReconnect={() => toast('→ Provider reconnect (not yet built)')} />
          ) : (
            <>
              {/* 4-col metrics — 2×2 on mobile (skill: grid breakpoints) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Generation"
                  value="2,140"
                  unit="W"
                  caption="↑ from panels"
                  icon={<Zap size={15} />}
                  accentClass="text-amber-400"
                  glowColor="rgba(251,191,36,0.12)"
                  stale={isStale}
                />
                <MetricCard
                  label="Consumption"
                  value="920"
                  unit="W"
                  caption="home using now"
                  icon={<Home size={15} />}
                  accentClass="text-slate-400"
                  glowColor="rgba(100,116,139,0.12)"
                  stale={isStale}
                />
                <MetricCard
                  label="Import"
                  value="310"
                  unit="W"
                  caption="from grid"
                  icon={<ArrowDownToLine size={15} />}
                  accentClass="text-slate-500"
                  glowColor="rgba(71,85,105,0.12)"
                  stale={isStale}
                />
                <MetricCard
                  label="Export"
                  value="810"
                  unit="W"
                  caption="to grid"
                  icon={<ArrowUpFromLine size={15} />}
                  accentClass="text-emerald-400"
                  glowColor="rgba(52,211,153,0.12)"
                  stale={isStale}
                />
              </div>

              {/* Coverage bar */}
              <CoverageBar solarPct={85} stale={isStale} />

              {/* Live trend chart */}
              <LiveTrendChart data={chartData} stale={isStale} />

              {/* Secondary row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TodayTotals
                  stale={isStale}
                  onViewDay={() => toast('→ Daily History (not yet built)')}
                />
                <NotesPanel
                  state={screenState}
                  showEfficiency={true}
                  onDataHealth={() => toast('→ Data Health (not yet built)')}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Toast — skill: auto-dismiss 3–5s, aria-live for a11y */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl z-50 animate-fade-in whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
