'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, History, ArrowRight } from 'lucide-react';
import type { TariffVersionDetail, PricePeriod } from '@/src/tariffs/loader';

// ---------------------------------------------------------------------------
// Helpers (duplicated from page.tsx — pure functions, no server deps)
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

function formatRate(rate: string | null, isFree?: boolean): string {
  if (isFree) return 'Free';
  if (!rate) return '—';
  return `€${parseFloat(rate).toFixed(4)}`;
}

function formatStandingCharge(amount: string, unit: string): string {
  const val = parseFloat(amount).toFixed(2);
  if (unit === 'per_day') return `€${val}/day`;
  if (unit === 'per_month') return `€${val}/mo`;
  return `€${val}`;
}

function slotToTime(slot: number): string {
  const h = Math.floor((slot % 48) / 2);
  const m = slot % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ---------------------------------------------------------------------------
// Schedule rendering (mirrors the server-side components in page.tsx)
// ---------------------------------------------------------------------------

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SLOT_COUNT = 48;
const SLOT_WIDTH = 12;
const SLOT_GAP = 2;
const SLOT_HEIGHT = 24;
const DAY_PILL_SIZE = 42;
const DESKTOP_LABEL_WIDTH = 250;
const TWO_HOUR_MARKERS = Array.from({ length: 13 }, (_, i) => i * 2);

function gridWidth() {
  return SLOT_COUNT * SLOT_WIDTH + (SLOT_COUNT - 1) * SLOT_GAP;
}

type Scheme = {
  days: number[];
  slots: string[];
  periods: PricePeriod[];
};

function deriveSchemes(schedule: string[], allPeriods: PricePeriod[]): Scheme[] {
  const periodMap = new Map(allPeriods.map((p) => [p.id, p]));
  const dayPatterns = Array.from({ length: 7 }, (_, d) =>
    schedule.slice(d * 48, d * 48 + 48).join(','),
  );
  const seen = new Map<string, number>();
  const schemes: Scheme[] = [];
  for (let d = 0; d < 7; d++) {
    const key = dayPatterns[d];
    if (seen.has(key)) {
      schemes[seen.get(key)!].days.push(d);
    } else {
      const slots = schedule.slice(d * 48, d * 48 + 48);
      const periods = [...new Set(slots)]
        .map((id) => periodMap.get(id))
        .filter((p): p is PricePeriod => p !== undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      seen.set(key, schemes.length);
      schemes.push({ days: [d], slots, periods });
    }
  }
  return schemes;
}

const ACTIVE_FILL = '#3f4f67';
const ACTIVE_BORDER = 'rgba(235,248,255,0.35)';
const INACTIVE_FILL = '#27324a';
const INACTIVE_BORDER = 'rgba(255,255,255,0.06)';

function SchemeBlock({ scheme }: { scheme: Scheme }) {
  const daySet = new Set(scheme.days);
  const gw = gridWidth();

  const renderLabel = (period: PricePeriod) => (
    <>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-sm"
          style={{ backgroundColor: period.colourHex ?? '#64748b' }}
        />
        <div className="flex h-9 min-w-[88px] items-center rounded-xl border border-slate-700 bg-slate-950/70 pl-6 pr-3 text-sm font-medium text-slate-100">
          {period.periodLabel}
        </div>
      </div>
      <div className="flex h-9 min-w-[82px] items-center rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-100 tabular-nums">
        {formatRate(period.ratePerKwh, period.isFreeImport)}
      </div>
    </>
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4">
      <div className="mb-4 grid grid-cols-7 gap-2" style={{ width: DAY_PILL_SIZE * 7 + 8 * 6, maxWidth: '100%' }}>
        {DAY_LETTERS.map((letter, i) => (
          <div
            key={i}
            style={{
              width: DAY_PILL_SIZE, height: DAY_PILL_SIZE, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, userSelect: 'none', boxSizing: 'border-box',
              backgroundColor: daySet.has(i) ? '#475569' : '#1e293b',
              color: daySet.has(i) ? '#f1f5f9' : '#94a3b8',
              border: daySet.has(i) ? '1.5px solid #64748b' : '1.5px solid #334155',
            }}
          >
            {letter}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: gw }}>
          <div className="flex flex-col gap-3">
            {scheme.periods.map((period) => (
              <div key={period.id}>
                <div className="mb-2 flex items-center gap-2 md:hidden">{renderLabel(period)}</div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex shrink-0 items-center gap-2" style={{ width: DESKTOP_LABEL_WIDTH }}>
                    {renderLabel(period)}
                  </div>
                  <div className="relative flex-1">
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `repeat(${SLOT_COUNT}, ${SLOT_WIDTH}px)`, columnGap: `${SLOT_GAP}px`, width: gw }}
                    >
                      {scheme.slots.map((slotPeriodId, slot) => {
                        const isActive = slotPeriodId === period.id;
                        return (
                          <div
                            key={slot}
                            className="rounded-[1px]"
                            style={{
                              height: SLOT_HEIGHT,
                              backgroundColor: isActive ? ACTIVE_FILL : INACTIVE_FILL,
                              border: `1px solid ${isActive ? ACTIVE_BORDER : INACTIVE_BORDER}`,
                              boxSizing: 'border-box',
                            }}
                            title={`${slotToTime(slot)}–${slotToTime(slot + 1)}`}
                          />
                        );
                      })}
                    </div>
                    {TWO_HOUR_MARKERS.map((hour) => {
                      const left = hour === 0 ? -SLOT_GAP / 2
                        : hour === 24 ? gw + SLOT_GAP / 2
                        : hour * 2 * (SLOT_WIDTH + SLOT_GAP) - SLOT_GAP / 2;
                      const strong = hour % 6 === 0;
                      return (
                        <div
                          key={hour}
                          className="pointer-events-none absolute inset-y-[-8px] w-px -translate-x-1/2"
                          style={{
                            left,
                            backgroundImage: `repeating-linear-gradient(to bottom,
                              ${strong ? 'rgba(74,222,128,0.95)' : 'rgba(74,222,128,0.58)'} 0 6px,
                              transparent 6px 10px)`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-start gap-3">
            <div className="hidden md:block shrink-0" style={{ width: DESKTOP_LABEL_WIDTH }} />
            <div className="relative h-5" style={{ width: gw }}>
              {TWO_HOUR_MARKERS.map((hour) => {
                const left = Math.max(0, Math.min(gw, hour * 2 * (SLOT_WIDTH + SLOT_GAP)));
                const strong = hour % 6 === 0 || hour === 24;
                const pos = hour === 0 ? 'translate-x-0' : hour === 24 ? '-translate-x-full' : '-translate-x-1/2';
                return (
                  <div key={hour} className={`absolute top-0 text-[10px] tabular-nums ${pos}`} style={{ left }}>
                    <span className={strong ? 'font-semibold text-slate-300' : 'text-slate-500'}>{hour}</span>
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

function VersionDetail({ version }: { version: TariffVersionDetail }) {
  const hasSchedule = version.weeklyScheduleJson !== null && version.pricePeriods.length > 0;
  const standingCharge = version.fixedCharges.find((c) => c.chargeType === 'standing_charge') ?? null;

  return (
    <div className="space-y-4">
      {/* Charges row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {version.exportRate && (
          <span>Export <span className="text-slate-300 tabular-nums">{formatRate(version.exportRate)}</span></span>
        )}
        {standingCharge && (
          <span>
            Standing charge{' '}
            <span className="text-slate-300">{formatStandingCharge(standingCharge.amount, standingCharge.unit)}</span>
            {!standingCharge.vatInclusive && <span className="text-slate-600"> excl. VAT</span>}
          </span>
        )}
        {version.vatRate && (
          <span>VAT <span className="text-slate-300">{(parseFloat(version.vatRate) * 100).toFixed(0)}%</span></span>
        )}
      </div>

      {/* Schedule */}
      {hasSchedule ? (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-3">Weekly schedule</p>
          <div className="flex flex-col gap-3">
            {deriveSchemes(version.weeklyScheduleJson!, version.pricePeriods).map((scheme, i) => (
              <SchemeBlock key={i} scheme={scheme} />
            ))}
          </div>
        </div>
      ) : (
        // Legacy rate bands fallback
        (() => {
          const bands = [
            { label: 'Night', time: `${version.nightStartLocalTime ?? '23:00'}–${version.nightEndLocalTime ?? '08:00'}`, rate: version.nightRate, colour: '#3b82f6' },
            { label: 'Day', time: `${version.nightEndLocalTime ?? '08:00'}–${version.peakStartLocalTime ?? '17:00'}`, rate: version.dayRate, colour: '#f59e0b' },
            { label: 'Peak', time: `${version.peakStartLocalTime ?? '17:00'}–${version.peakEndLocalTime ?? '19:00'}`, rate: version.peakRate, colour: '#ef4444' },
          ].filter((b) => b.rate);
          if (bands.length === 0) return null;
          return (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Rate windows</p>
              <div className="flex flex-wrap gap-2">
                {bands.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: b.colour }} />
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
        })()
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VersionHistory({ versions }: { versions: TariffVersionDetail[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (versions.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <History size={15} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-200">Version history</h3>
      </div>

      <div className="flex flex-col gap-2">
        {versions.map((v) => {
          const isExpanded = expandedIds.has(v.id);
          return (
            <div key={v.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
              {/* Collapsed header */}
              <button
                type="button"
                onClick={() => toggle(v.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {v.supplierName} – {formatDate(v.validFromLocalDate)} to {v.validToLocalDate ? formatDate(v.validToLocalDate) : 'present'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/settings/tariffs/${v.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Edit <ArrowRight size={10} />
                  </Link>
                  {isExpanded
                    ? <ChevronUp size={14} className="text-slate-500" />
                    : <ChevronDown size={14} className="text-slate-500" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-5 pt-1 border-t border-slate-800/60">
                  <VersionDetail version={v} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
