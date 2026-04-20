import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  AlertTriangle,
  Info,
  ArrowRight,
  CheckCircle2,
  History,
} from 'lucide-react';
import { loadTariffOverview } from '@/src/tariffs/loader';
import type {
  TariffVersionDetail,
  TariffVersionSummary,
  ContractInfo,
  PricePeriod,
} from '@/src/tariffs/loader';
import { getSession } from '@/src/auth-helpers';
import { loadInstallationId } from '@/src/installation-helpers';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

function formatRate(rate: string | null, isFree?: boolean): string {
  if (isFree) return 'Free';
  if (!rate) return '—';
  const c = (parseFloat(rate) * 100).toFixed(2);
  return `${c}¢`;
}

function formatStandingCharge(amount: string, unit: string): string {
  const val = parseFloat(amount).toFixed(2);
  if (unit === 'per_day') return `€${val}/day`;
  if (unit === 'per_month') return `€${val}/mo`;
  return `€${val}`;
}

function daysUntil(localDate: string): number {
  const target = new Date(localDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function slotToTime(slot: number): string {
  const h = Math.floor((slot % 48) / 2);
  const m = slot % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ---------------------------------------------------------------------------
// Scheme derivation
// Groups the 7 days (Mon=0 … Sun=6) by identical 48-slot pattern.
// Returns one entry per unique pattern, sorted by first day index.
// ---------------------------------------------------------------------------

type TariffScheme = {
  /** Day indices (0=Mon … 6=Sun) that share this pattern. */
  days: number[];
  /** The 48-slot pattern (period IDs). */
  slots: string[];
  /** Price periods that actually appear in this scheme's slots. */
  periods: PricePeriod[];
};

function deriveSchemes(schedule: string[], allPeriods: PricePeriod[]): TariffScheme[] {
  const periodMap = new Map(allPeriods.map((p) => [p.id, p]));
  // Represent each day's pattern as a stable string key for grouping
  const dayPatterns: string[] = Array.from({ length: 7 }, (_, d) =>
    schedule.slice(d * 48, d * 48 + 48).join(','),
  );

  const seen = new Map<string, number>(); // pattern key → scheme index
  const schemes: TariffScheme[] = [];

  for (let d = 0; d < 7; d++) {
    const key = dayPatterns[d];
    if (seen.has(key)) {
      schemes[seen.get(key)!].days.push(d);
    } else {
      const slots = schedule.slice(d * 48, d * 48 + 48);
      const uniqueIds = [...new Set(slots)];
      const periods = uniqueIds
        .map((id) => periodMap.get(id))
        .filter((p): p is PricePeriod => p !== undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      seen.set(key, schemes.length);
      schemes.push({ days: [d], slots, periods });
    }
  }

  return schemes;
}

// ---------------------------------------------------------------------------
// Scheme block: day pills + one row per period with 48-slot activity bar
// ---------------------------------------------------------------------------

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SLOT_COUNT = 48;
const MOBILE_SLOT_WIDTH = 12;
const SLOT_GAP = 2;
const SLOT_HEIGHT_MOBILE = 24;
const DAY_PILL_SIZE = 42;
const DESKTOP_LABEL_WIDTH = 250;
const TWO_HOUR_MARKERS = Array.from({ length: 13 }, (_, i) => i * 2); // 0..24

function gridWidth(slotWidth: number): number {
  return SLOT_COUNT * slotWidth + (SLOT_COUNT - 1) * SLOT_GAP;
}

function TariffSchemeBlock({ scheme }: { scheme: TariffScheme }) {
  const daySet = new Set(scheme.days);
  const mobileWidth = gridWidth(MOBILE_SLOT_WIDTH);
  const railInnerWidth = mobileWidth - MOBILE_SLOT_WIDTH; // 24 sits on the far edge
  const ACTIVE_SLOT_FILL = '#3f4f67';
  const ACTIVE_SLOT_BORDER = 'rgba(235,248,255,0.35)';
  const INACTIVE_SLOT_FILL = '#27324a';
  const INACTIVE_SLOT_BORDER = 'rgba(255,255,255,0.06)';

  const renderPeriodDisplay = (period: PricePeriod) => (
    <>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-sm"
          style={{ backgroundColor: period.colourHex ?? '#64748b' }}
        />
        <div className="flex h-9 min-w-[88px] items-center rounded-xl border border-slate-700 bg-slate-950/70 pl-6 pr-3 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {period.periodLabel}
        </div>
      </div>
      <div className="flex h-9 min-w-[82px] items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-100 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {formatRate(period.ratePerKwh, period.isFreeImport)}
      </div>
    </>
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4">
      {/* Day pills */}
      <div
        className="mb-4 grid grid-cols-7 gap-2"
        style={{ width: DAY_PILL_SIZE * 7 + 8 * 6, maxWidth: '100%' }}
      >
        {DAY_LETTERS.map((letter, i) => {
          const active = daySet.has(i);
          return (
            <div
              key={i}
              style={{
                width: DAY_PILL_SIZE,
                height: DAY_PILL_SIZE,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1,
                userSelect: 'none',
                backgroundColor: active ? '#475569' : '#1e293b',
                color: active ? '#f1f5f9' : '#94a3b8',
                border: active ? '1.5px solid #64748b' : '1.5px solid #334155',
                boxSizing: 'border-box',
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>

      {/* Scrollable bars region */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: mobileWidth }}>

          {/* Period rows */}
          <div className="flex flex-col gap-3">
            {scheme.periods.map((period) => (
              <div key={period.id}>
                {/* Mobile controls */}
                <div className="mb-2 flex items-center gap-2 md:hidden">
                  {renderPeriodDisplay(period)}
                </div>

                <div className="flex items-center gap-3">
                  {/* Desktop-only left label */}
                  <div className="hidden md:flex shrink-0 items-center gap-2" style={{ width: DESKTOP_LABEL_WIDTH }}>
                    {renderPeriodDisplay(period)}
                  </div>

                  {/* Activity bar with deterministic slot geometry and 2-hour markers */}
                  <div className="relative flex-1">
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${SLOT_COUNT}, ${MOBILE_SLOT_WIDTH}px)`,
                        columnGap: `${SLOT_GAP}px`,
                        width: mobileWidth,
                      }}
                    >
                      {scheme.slots.map((slotPeriodId, slot) => {
                        const isActive = slotPeriodId === period.id;
                        return (
                          <div
                            key={slot}
                            className="rounded-[1px]"
                            style={{
                              height: SLOT_HEIGHT_MOBILE,
                              backgroundColor: isActive ? ACTIVE_SLOT_FILL : INACTIVE_SLOT_FILL,
                              border: `1px solid ${isActive ? ACTIVE_SLOT_BORDER : INACTIVE_SLOT_BORDER}`,
                              boxSizing: 'border-box',
                            }}
                            title={`${slotToTime(slot)}–${slotToTime(slot + 1)}`}
                          />
                        );
                      })}
                    </div>
                    {TWO_HOUR_MARKERS.map((hour) => {
                      const slotIndex = hour * 2;
                      const left =
                        hour === 0
                          ? -SLOT_GAP / 2
                          : hour === 24
                            ? mobileWidth + SLOT_GAP / 2
                            : slotIndex * (MOBILE_SLOT_WIDTH + SLOT_GAP) - SLOT_GAP / 2;
                      const isStrong = hour % 6 === 0;
                      return (
                        <div
                          key={hour}
                          className="pointer-events-none absolute inset-y-[-8px] w-px -translate-x-1/2"
                          style={{
                            left,
                            backgroundImage: `repeating-linear-gradient(
                              to bottom,
                              ${isStrong ? 'rgba(74,222,128,0.95)' : 'rgba(74,222,128,0.58)'} 0 6px,
                              transparent 6px 10px
                            )`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Time axis — offset by label column on desktop, flush on mobile */}
          <div className="mt-2 flex items-start gap-3">
            <div className="hidden md:block shrink-0" style={{ width: DESKTOP_LABEL_WIDTH }} />
            <div className="relative h-5" style={{ width: mobileWidth }}>
              {TWO_HOUR_MARKERS.map((hour) => {
                const left = Math.max(
                  0,
                  Math.min(mobileWidth, hour * 2 * (MOBILE_SLOT_WIDTH + SLOT_GAP)),
                );
                const isStrong = hour % 6 === 0 || hour === 24;
                const positionClass =
                  hour === 0 ? 'translate-x-0' : hour === 24 ? '-translate-x-full' : '-translate-x-1/2';
                return (
                  <div
                    key={hour}
                    className={`absolute top-0 text-[10px] tabular-nums ${positionClass}`}
                    style={{ left }}
                  >
                    <span className={isStrong ? 'font-semibold text-slate-300' : 'text-slate-500'}>
                      {hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule section: derives and renders all scheme blocks
// ---------------------------------------------------------------------------

function ScheduleSection({
  version,
}: {
  version: TariffVersionDetail;
}) {
  const hasSchedule =
    version.weeklyScheduleJson !== null && version.pricePeriods.length > 0;

  if (!hasSchedule) {
    // Legacy fallback — no schedule JSON, show rate window tiles
    return <LegacyRateBands version={version} />;
  }

  const schemes = deriveSchemes(version.weeklyScheduleJson!, version.pricePeriods);

  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-3">Weekly schedule</p>
      <div className="flex flex-col gap-3">
        {schemes.map((scheme, i) => (
          <TariffSchemeBlock key={i} scheme={scheme} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy rate window fallback (no weeklyScheduleJson)
// ---------------------------------------------------------------------------

function LegacyRateBands({ version }: { version: TariffVersionDetail }) {
  const bands = [
    {
      label: 'Night',
      time: `${version.nightStartLocalTime ?? '23:00'}–${version.nightEndLocalTime ?? '08:00'}`,
      rate: version.nightRate,
      colour: '#3b82f6',
    },
    {
      label: 'Day',
      time: `${version.nightEndLocalTime ?? '08:00'}–${version.peakStartLocalTime ?? '17:00'}`,
      rate: version.dayRate,
      colour: '#f59e0b',
    },
    {
      label: 'Peak',
      time: `${version.peakStartLocalTime ?? '17:00'}–${version.peakEndLocalTime ?? '19:00'}`,
      rate: version.peakRate,
      colour: '#ef4444',
    },
  ].filter((b) => b.rate);

  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-2">Rate windows</p>
      <div className="flex flex-wrap gap-2">
        {bands.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
          >
            <span
              className="inline-block h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: b.colour }}
            />
            <div>
              <p className="text-xs font-medium text-slate-200">{b.label}</p>
              <p className="text-[10px] text-slate-500">{b.time}</p>
              <p className="text-xs text-slate-300 tabular-nums">{formatRate(b.rate)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract reminder banner
// ---------------------------------------------------------------------------

function ContractBanner({ contract }: { contract: ContractInfo }) {
  const reviewDays = contract.expectedReviewDate ? daysUntil(contract.expectedReviewDate) : null;
  const endDays    = contract.contractEndDate    ? daysUntil(contract.contractEndDate)    : null;

  const isExpired   = endDays !== null && endDays < 0;
  const endingSoon  = !isExpired && endDays !== null && endDays <= 90;
  const reviewSoon  = !isExpired && reviewDays !== null && reviewDays >= 0 && reviewDays <= 60;

  if (!isExpired && !endingSoon && !reviewSoon) return null;

  const isUrgent = isExpired || (endDays !== null && endDays <= 30);

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-2xl border px-4 py-3.5',
        isUrgent ? 'border-red-800/40 bg-red-950/30' : 'border-amber-700/30 bg-amber-950/20',
      ].join(' ')}
    >
      <AlertTriangle
        size={15}
        className={['mt-0.5 shrink-0', isUrgent ? 'text-red-400' : 'text-amber-400'].join(' ')}
      />
      <div className="flex-1 min-w-0">
        {isExpired && (
          <p className="text-sm font-medium text-red-300">Contract expired</p>
        )}
        {!isExpired && endingSoon && endDays !== null && (
          <p className={['text-sm font-medium', isUrgent ? 'text-red-300' : 'text-amber-300'].join(' ')}>
            Contract ends in {endDays} day{endDays !== 1 ? 's' : ''}
          </p>
        )}
        {!isExpired && !endingSoon && reviewSoon && reviewDays !== null && (
          <p className="text-sm font-medium text-amber-300">
            Tariff review due in {reviewDays} day{reviewDays !== 1 ? 's' : ''}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">
          {contract.contractEndDate
            ? `Contract end date: ${formatDate(contract.contractEndDate)}.`
            : ''}{' '}
          {contract.notes && <span className="text-slate-500">{contract.notes}</span>}
        </p>
      </div>
      <Link
        href="#"
        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
      >
        Review <ArrowRight size={10} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active tariff card
// ---------------------------------------------------------------------------

function CurrentTariffCard({
  version,
  supplierName,
  planName,
  isExportEnabled,
}: {
  version: TariffVersionDetail;
  supplierName: string;
  planName: string;
  isExportEnabled: boolean;
}) {
  const standingCharge =
    version.fixedCharges.find((c) => c.chargeType === 'standing_charge') ?? null;

  return (
    <div className="rounded-[20px] border border-emerald-800/30 bg-[#0d1f18] p-5 shadow-[0_8px_30px_rgba(2,6,23,0.25)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
              Active tariff
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-100">{planName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {supplierName}
            {version.versionLabel !== planName ? ` · ${version.versionLabel}` : ''}
          </p>
        </div>
        <Link
          href="#"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
        >
          Edit <ArrowRight size={10} />
        </Link>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          From <span className="text-slate-300">{formatDate(version.validFromLocalDate)}</span>
        </span>
        {version.validToLocalDate ? (
          <span>
            To <span className="text-slate-300">{formatDate(version.validToLocalDate)}</span>
          </span>
        ) : (
          <span className="text-emerald-600">No end date</span>
        )}
        {isExportEnabled && version.exportRate && (
          <span>
            Export <span className="text-slate-300 tabular-nums">{formatRate(version.exportRate)}</span>
          </span>
        )}
        {standingCharge && (
          <span>
            Standing charge{' '}
            <span className="text-slate-300">
              {formatStandingCharge(standingCharge.amount, standingCharge.unit)}
            </span>
            {!standingCharge.vatInclusive && (
              <span className="text-slate-600"> excl. VAT</span>
            )}
          </span>
        )}
        {version.vatRate && (
          <span>
            VAT{' '}
            <span className="text-slate-300">
              {(parseFloat(version.vatRate) * 100).toFixed(0)}%
            </span>
          </span>
        )}
      </div>

      {/* Schedule */}
      <div className="mt-5 pt-4 border-t border-slate-800/60">
        <ScheduleSection version={version} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version history timeline
// ---------------------------------------------------------------------------

function VersionTimeline({ versions }: { versions: TariffVersionSummary[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Version history</h3>
        </div>
        <Link
          href="#"
          className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-600/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          <Plus size={11} />
          Add version
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {versions.map((v, i) => {
          const isCurrent = v.isActiveDefault || v.validToLocalDate === null;
          return (
            <div
              key={v.id}
              className={[
                'relative flex items-start gap-4 rounded-2xl border px-4 py-3.5',
                isCurrent
                  ? 'border-emerald-800/30 bg-[#0d1f18]'
                  : 'border-slate-800/60 bg-slate-900/40',
              ].join(' ')}
            >
              {i < versions.length - 1 && (
                <div className="absolute left-[1.65rem] top-full h-2 w-px bg-slate-800" />
              )}
              <div
                className={[
                  'mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border',
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-500/40'
                    : 'border-slate-600 bg-slate-700',
                ].join(' ')}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p
                      className={[
                        'text-sm font-medium',
                        isCurrent ? 'text-slate-100' : 'text-slate-300',
                      ].join(' ')}
                    >
                      {v.versionLabel}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(v.validFromLocalDate)}
                      {' — '}
                      {v.validToLocalDate ? formatDate(v.validToLocalDate) : 'present'}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-emerald-900/50 border border-emerald-800/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                  {v.dayRate && (
                    <span>Day <span className="text-slate-300 tabular-nums">{formatRate(v.dayRate)}</span></span>
                  )}
                  {v.nightRate && (
                    <span>Night <span className="text-slate-300 tabular-nums">{formatRate(v.nightRate)}</span></span>
                  )}
                  {v.peakRate && (
                    <span>Peak <span className="text-slate-300 tabular-nums">{formatRate(v.peakRate)}</span></span>
                  )}
                  {v.exportRate && (
                    <span>Export <span className="text-slate-300 tabular-nums">{formatRate(v.exportRate)}</span></span>
                  )}
                </div>
              </div>
              {!isCurrent && (
                <Link
                  href="#"
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  View
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="mt-8 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
      <Receipt size={28} className="mx-auto mb-4 text-slate-600" />
      <p className="text-sm font-semibold text-slate-300">No tariff set up yet</p>
      <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
        Add your electricity tariff to start seeing cost and savings calculations.
        You can add multiple rate versions if your tariff has changed over time.
      </p>
      <Link
        href="#"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
      >
        <Plus size={12} />
        Set up tariff
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TariffsPage() {
  const session = await getSession();
  if (!session?.userId) redirect('/api/auth/signin');

  const installationId = await loadInstallationId(session.userId);
  if (!installationId) redirect('/settings');

  const data = await loadTariffOverview(installationId);
  const isEmpty = !data.plan || data.allVersions.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-100">Tariffs</h1>
        </div>
        {!isEmpty && (
          <Link
            href="#"
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-600/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            <Plus size={11} />
            Add version
          </Link>
        )}
      </div>

      <p className="text-sm text-slate-400 leading-relaxed mb-8">
        Manage your electricity tariff history — import rates, export rates, standing charges,
        and contract dates. Tariff data is required for all cost and savings calculations.
      </p>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          {data.contract && <ContractBanner contract={data.contract} />}

          {data.activeVersion && (
            <CurrentTariffCard
              version={data.activeVersion}
              supplierName={data.plan!.supplierName}
              planName={data.plan!.planName}
              isExportEnabled={data.plan!.isExportEnabled}
            />
          )}

          {data.allVersions.length > 0 && (
            <VersionTimeline versions={data.allVersions} />
          )}

          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-800/60 bg-slate-900/30 px-4 py-3.5">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Editing a tariff version will trigger a recalculation of all historical cost and
              savings figures that fall within that version's date range. This may take a few
              moments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
