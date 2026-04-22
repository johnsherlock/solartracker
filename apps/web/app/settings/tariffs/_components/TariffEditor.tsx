'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowLeft,
  X,
  Loader2,
} from 'lucide-react';
import type { TariffVersionSummary } from '@/src/tariffs/loader';
import { saveTariffVersion } from '../actions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_WIDTH = 12;
const SLOT_GAP = 2;
const SLOT_HEIGHT = 22;
const SLOT_COUNT = 48;
const GRID_WIDTH = SLOT_COUNT * SLOT_WIDTH + (SLOT_COUNT - 1) * SLOT_GAP;
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TWO_HOUR_MARKERS = Array.from({ length: 13 }, (_, i) => i * 2);
const DAY_PILL_SIZE = 38;
const LABEL_COL_WIDTH = 220;

// Slot colours matching the overview TariffSchemeBlock
const ACTIVE_SLOT_FILL = '#3f4f67';
const ACTIVE_SLOT_BORDER = 'rgba(235,248,255,0.35)';
const INACTIVE_SLOT_FILL = '#27324a';
const INACTIVE_SLOT_BORDER = 'rgba(255,255,255,0.06)';

const COLOUR_PALETTE = [
  '#3b82f6', '#f59e0b', '#ef4444', '#10b981',
  '#8b5cf6', '#f97316', '#14b8a6', '#ec4899',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorPeriod = {
  id: string;
  periodLabel: string;
  ratePerKwh: string;
  isFreeImport: boolean;
  colourHex: string;
};

type EditorGroup = {
  id: string;
  days: number[];
  periods: EditorPeriod[];
  slots: string[];
};

export type TariffEditorInitialData = {
  versionId?: string;
  supplierName: string;
  planName: string;
  validFromLocalDate: string;
  validToLocalDate: string;
  periods: EditorPeriod[];
  schedule: string[];
  exportRate: string;
  /** VAT rate as a percentage string, e.g. "9" or "8.5". */
  vatRate: string;
  standingChargeAmount: string;
};

type Props = {
  mode: 'create' | 'edit';
  initial: TariffEditorInitialData;
  existingVersions: TariffVersionSummary[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotToTime(slot: number): string {
  const h = Math.floor(slot / 2);
  const m = slot % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function nextColour(periods: EditorPeriod[]): string {
  const used = new Set(periods.map((p) => p.colourHex));
  return COLOUR_PALETTE.find((c) => !used.has(c)) ?? COLOUR_PALETTE[periods.length % COLOUR_PALETTE.length];
}

function deriveGroups(periods: EditorPeriod[], schedule: string[]): EditorGroup[] {
  if (periods.length === 0 || schedule.length < 336 || schedule.every((s) => s === '')) return [];
  const periodMap = new Map(periods.map((p) => [p.id, p]));
  const dayPatterns = Array.from({ length: 7 }, (_, d) =>
    schedule.slice(d * SLOT_COUNT, d * SLOT_COUNT + SLOT_COUNT).join(','),
  );
  const seen = new Map<string, number>();
  const groups: EditorGroup[] = [];
  for (let d = 0; d < 7; d++) {
    const key = dayPatterns[d];
    if (seen.has(key)) {
      groups[seen.get(key)!].days.push(d);
    } else {
      const slots = schedule.slice(d * SLOT_COUNT, d * SLOT_COUNT + SLOT_COUNT);
      const groupPeriods = [...new Set(slots)]
        .filter(Boolean)
        .map((id) => periodMap.get(id))
        .filter((p): p is EditorPeriod => !!p);
      seen.set(key, groups.length);
      groups.push({ id: newId(), days: [d], periods: groupPeriods, slots });
    }
  }
  return groups;
}

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return toLocalIso(d);
}

function checkOverlap(
  from: string,
  to: string,
  versions: TariffVersionSummary[],
  excludeId?: string,
): TariffVersionSummary | null {
  if (!from) return null;
  const aEnd = to || '9999-12-31';
  for (const v of versions) {
    if (excludeId && v.id === excludeId) continue;
    const bEnd = v.validToLocalDate ?? '9999-12-31';
    if (from <= bEnd && aEnd >= v.validFromLocalDate) return v;
  }
  return null;
}

function dailyToAnnual(daily: string): string {
  const v = parseFloat(daily);
  return isNaN(v) ? '' : (v * 365).toFixed(2);
}

function annualToDaily(annual: string): string {
  const v = parseFloat(annual);
  return isNaN(v) ? '' : (v / 365).toFixed(4);
}

/** Format a Date using local time components — avoids UTC conversion shifting the date. */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCalCells(year: number, month: number) {
  // Mon = 0 offset (getDay returns Sun = 0)
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];

  // Previous month tail
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ iso: toLocalIso(d), day: d.getDate(), inMonth: false });
  }
  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toLocalIso(new Date(year, month, d)), day: d, inMonth: true });
  }
  // Next month head — pad to complete the last row
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({ iso: toLocalIso(d), day: d.getDate(), inMonth: false });
  }
  return cells;
}

function formatDisplayDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

function buildSavePayload(groups: EditorGroup[]): {
  periods: { clientId: string; periodLabel: string; ratePerKwh: string; colourHex: string }[];
  weeklySchedule: string[];
} {
  const schedule = new Array<string>(336).fill('');
  const seen = new Set<string>();
  const periods: { clientId: string; periodLabel: string; ratePerKwh: string; colourHex: string }[] = [];

  for (const group of groups) {
    for (const p of group.periods) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        periods.push({ clientId: p.id, periodLabel: p.periodLabel, ratePerKwh: p.ratePerKwh, colourHex: p.colourHex });
      }
    }
    for (const day of group.days) {
      const offset = day * SLOT_COUNT;
      for (let s = 0; s < SLOT_COUNT; s++) {
        schedule[offset + s] = group.slots[s];
      }
    }
  }

  return { periods, weeklySchedule: schedule };
}

// ---------------------------------------------------------------------------
// Shared styling
// ---------------------------------------------------------------------------

// Base input without border colour — use ib() to apply the correct border
const INPUT_BASE =
  'w-full rounded-xl border bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none';
// Kept for any places that don't need error-aware borders
const INPUT_CLS = `${INPUT_BASE} border-slate-700 focus:border-slate-500`;
// Returns the correct border classes depending on error state (avoids Tailwind
// stylesheet-order conflicts when both border-slate-* and border-red-* appear)
function ib(error?: boolean): string {
  return error
    ? 'border-red-700 focus:border-red-600'
    : 'border-slate-700 focus:border-slate-500';
}
// Appended to number inputs: removes spin buttons
const NO_SPIN =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const LABEL_CLS =
  'block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5';
const ERR_CLS = 'mt-1 text-xs text-red-400';

// ---------------------------------------------------------------------------
// DateField — custom calendar picker matching the app's visual style
// ---------------------------------------------------------------------------

function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  error,
  disabled,
  minDate,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  minDate?: string;
}) {
  const today = toLocalIso(new Date());
  const seed = value || today;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseInt(seed.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(seed.slice(5, 7)) - 1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.slice(0, 4)));
      setViewMonth(parseInt(value.slice(5, 7)) - 1);
    }
  }, [value]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const cells = buildCalCells(viewYear, viewMonth);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors bg-slate-900/60 focus:outline-none',
          disabled
            ? 'border-slate-800 cursor-not-allowed opacity-40'
            : error
              ? 'border-red-700 hover:border-red-600'
              : open
                ? 'border-slate-500'
                : 'border-slate-700 hover:border-slate-600',
        ].join(' ')}
      >
        <span className={value ? 'text-slate-100' : 'text-slate-600'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar size={13} className="shrink-0 text-slate-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-2xl border border-slate-700 bg-[#0f1a2b] shadow-2xl">
          {/* Month navigator */}
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-semibold text-slate-200">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="px-3 py-3">
            <div className="mb-1 grid grid-cols-7 text-center">
              {DOW_LABELS.map((d) => (
                <span key={d} className="text-[10px] font-semibold text-slate-600">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const isSelected = cell.iso === value;
                const isToday = cell.iso === today;
                const isDisabled = !!(minDate && cell.iso < minDate);
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => { if (!isDisabled) { onChange(cell.iso); setOpen(false); } }}
                    className={[
                      'flex h-7 w-full items-center justify-center rounded-full text-[11px] transition-colors',
                      isDisabled
                        ? 'text-slate-700 cursor-not-allowed'
                        : isSelected
                          ? 'bg-emerald-600 font-semibold text-white'
                          : isToday
                            ? 'font-medium text-emerald-400 ring-1 ring-emerald-600/60 hover:bg-slate-800'
                            : cell.inMonth
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-600 hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        className={[
          'flex w-full items-center justify-between px-5 py-4',
          collapsible ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
      >
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        {collapsible && (open
          ? <ChevronUp size={14} className="text-slate-500" />
          : <ChevronDown size={14} className="text-slate-500" />
        )}
      </button>
      {(!collapsible || open) && (
        <div className="px-5 pb-5 border-t border-slate-800/60">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodInputs — name + rate fields; shows red borders when submitted + invalid
// ---------------------------------------------------------------------------

function PeriodInputs({
  period,
  index,
  submitted,
  onChange,
}: {
  period: EditorPeriod;
  index: number;
  submitted: boolean;
  onChange: (updated: EditorPeriod) => void;
}) {
  const nameError = submitted && !period.periodLabel.trim();
  const rateError = submitted && !period.ratePerKwh;

  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      {/* Period name — takes all remaining space */}
      <input
        type="text"
        value={period.periodLabel}
        onChange={(e) => onChange({ ...period, periodLabel: e.target.value })}
        placeholder={`Period ${index + 1}`}
        className={[
          'flex-1 min-w-0 rounded-lg border bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500',
          nameError ? 'border-red-700' : 'border-slate-700',
        ].join(' ')}
      />
      {/* Rate — € prefix + x.xxxx input + ex-VAT label */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm text-slate-400">€</span>
        <input
          type="number"
          step="0.0001"
          min="0"
          value={period.ratePerKwh}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== '' && parseFloat(v) < 0) return;
            onChange({ ...period, ratePerKwh: v });
          }}
          onKeyDown={(e) => e.key === '-' && e.preventDefault()}
          placeholder="0.0000"
          className={[
            'w-16 rounded-lg border bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 tabular-nums',
            NO_SPIN,
            rateError ? 'border-red-700' : 'border-slate-700',
          ].join(' ')}
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">ex-VAT</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityBar
// ---------------------------------------------------------------------------

function ActivityBar({
  groupSlots,
  periodId,
  onMouseDown,
  onMouseEnter,
}: {
  groupSlots: string[];
  periodId: string;
  onMouseDown: (slotIdx: number) => void;
  onMouseEnter: (slotIdx: number) => void;
}) {
  // tipSlot + fixed pixel position so the tooltip escapes overflow-x-auto clipping
  const [tipSlot, setTipSlot] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  function showTip(slotIdx: number) {
    setTipSlot(slotIdx);
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const rawLeft = rect.left + slotIdx * (SLOT_WIDTH + SLOT_GAP);
      setTipPos({
        left: Math.min(rawLeft, rect.right - 72),
        top: rect.top - 26,
      });
    }
  }

  function slotFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const s = el?.dataset?.slot;
    return s !== undefined ? parseInt(s, 10) : null;
  }

  return (
    <div className="relative flex-1">
      {/* Tooltip rendered via portal so overflow-x-auto clipping can't hide it */}
      {tipSlot !== null && tipPos !== null &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded bg-slate-800/95 px-1.5 py-0.5 text-[11px] font-sans text-slate-200 whitespace-nowrap shadow-lg"
            style={{ left: tipPos.left, top: tipPos.top }}
          >
            {slotToTime(tipSlot)}–{slotToTime(tipSlot + 1)}
          </div>,
          document.body,
        )
      }
      <div
        ref={gridRef}
        className="grid select-none"
        style={{
          gridTemplateColumns: `repeat(${SLOT_COUNT}, ${SLOT_WIDTH}px)`,
          columnGap: `${SLOT_GAP}px`,
          width: GRID_WIDTH,
        }}
        onMouseLeave={() => { setTipSlot(null); setTipPos(null); }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          const s = slotFromPoint(t.clientX, t.clientY);
          if (s !== null) showTip(s);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          const s = slotFromPoint(t.clientX, t.clientY);
          if (s !== null) showTip(s);
        }}
        onTouchEnd={() => { setTipSlot(null); setTipPos(null); }}
        onTouchCancel={() => { setTipSlot(null); setTipPos(null); }}
      >
        {groupSlots.map((pid, slotIdx) => {
          const isActive = pid === periodId;
          return (
            <div
              key={slotIdx}
              data-slot={slotIdx}
              style={{
                height: SLOT_HEIGHT,
                backgroundColor: isActive ? ACTIVE_SLOT_FILL : INACTIVE_SLOT_FILL,
                border: `1px solid ${isActive ? ACTIVE_SLOT_BORDER : INACTIVE_SLOT_BORDER}`,
                borderRadius: 1,
                boxSizing: 'border-box',
                cursor: 'crosshair',
              }}
              onMouseDown={() => onMouseDown(slotIdx)}
              onMouseEnter={() => { showTip(slotIdx); onMouseEnter(slotIdx); }}
            />
          );
        })}
      </div>
      {TWO_HOUR_MARKERS.map((hour) => {
        const left =
          hour === 0 ? -SLOT_GAP / 2
          : hour === 24 ? GRID_WIDTH + SLOT_GAP / 2
          : hour * 2 * (SLOT_WIDTH + SLOT_GAP) - SLOT_GAP / 2;
        const strong = hour % 6 === 0;
        return (
          <div
            key={hour}
            className="pointer-events-none absolute inset-y-[-6px] w-px"
            style={{
              left,
              backgroundImage: `repeating-linear-gradient(to bottom,
                ${strong ? 'rgba(74,222,128,0.9)' : 'rgba(74,222,128,0.45)'} 0 5px,
                transparent 5px 9px)`,
            }}
          />
        );
      })}
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="relative h-5" style={{ width: GRID_WIDTH }}>
      {TWO_HOUR_MARKERS.map((hour) => {
        const left = Math.max(0, Math.min(GRID_WIDTH, hour * 2 * (SLOT_WIDTH + SLOT_GAP)));
        const strong = hour % 6 === 0 || hour === 24;
        const pos = hour === 0 ? 'translate-x-0' : hour === 24 ? '-translate-x-full' : '-translate-x-1/2';
        return (
          <div
            key={hour}
            className={`absolute top-0 text-[10px] tabular-nums pointer-events-none ${pos}`}
            style={{ left }}
          >
            <span className={strong ? 'font-semibold text-slate-300' : 'text-slate-500'}>{hour}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleGroupCard
// ---------------------------------------------------------------------------

type GroupCardProps = {
  group: EditorGroup;
  allGroups: EditorGroup[];
  canDelete: boolean;
  submitted: boolean;
  onUpdate: (updated: EditorGroup) => void;
  onDelete: () => void;
  onClaimDay: (dayIdx: number) => void;
  onPaintSlot: (slotIdx: number, value: string) => void;
};

function ScheduleGroupCard({
  group, allGroups, canDelete, submitted,
  onUpdate, onDelete, onClaimDay, onPaintSlot,
}: GroupCardProps) {
  const isPaintingRef = useRef(false);
  const paintValueRef = useRef<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = () => { isPaintingRef.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!isPaintingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
      const slotStr = target?.dataset?.slot;
      if (slotStr !== undefined) onPaintSlot(parseInt(slotStr, 10), paintValueRef.current);
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSlotMouseDown(periodId: string, slotIdx: number) {
    isPaintingRef.current = true;
    paintValueRef.current = group.slots[slotIdx] === periodId ? '' : periodId;
    onPaintSlot(slotIdx, paintValueRef.current);
  }
  function handleSlotMouseEnter(slotIdx: number) {
    if (isPaintingRef.current) onPaintSlot(slotIdx, paintValueRef.current);
  }
  function toggleDay(dayIdx: number) {
    if (group.days.includes(dayIdx)) onUpdate({ ...group, days: group.days.filter((d) => d !== dayIdx) });
    else onClaimDay(dayIdx);
  }
  function addPeriod() {
    onUpdate({
      ...group,
      periods: [...group.periods, {
        id: newId(), periodLabel: '', ratePerKwh: '',
        isFreeImport: false, colourHex: nextColour(group.periods),
      }],
    });
  }
  function updatePeriod(idx: number, updated: EditorPeriod) {
    onUpdate({ ...group, periods: group.periods.map((p, i) => (i === idx ? updated : p)) });
  }
  function removePeriod(idx: number) {
    const removed = group.periods[idx];
    onUpdate({
      ...group,
      periods: group.periods.filter((_, i) => i !== idx),
      slots: group.slots.map((pid) => (pid === removed.id ? '' : pid)),
    });
  }

  const daySet = new Set(group.days);
  const otherDays = new Set(allGroups.filter((g) => g.id !== group.id).flatMap((g) => g.days));
  const unassigned = group.slots.filter((s) => s === '').length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4">
      {/* Day pills */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className={LABEL_CLS + ' mb-2'}>Days</p>
          <div className="flex gap-1.5">
            {DAY_LETTERS.map((letter, i) => {
              const active = daySet.has(i);
              const taken = !active && otherDays.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !taken && toggleDay(i)}
                  disabled={taken}
                  title={taken ? `${DAY_LABELS[i]} is in another group` : DAY_LABELS[i]}
                  style={{
                    width: DAY_PILL_SIZE, height: DAY_PILL_SIZE,
                    borderRadius: '50%', fontSize: 12, fontWeight: 600,
                    userSelect: 'none', boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? '#475569' : taken ? '#18202e' : '#1e293b',
                    color: active ? '#f1f5f9' : taken ? '#2d3a4e' : '#64748b',
                    border: `1.5px solid ${active ? '#64748b' : taken ? '#232d3e' : '#2d3a4e'}`,
                    cursor: taken ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.1s, color 0.1s',
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            title="Remove group"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {group.periods.length === 0 && (
        <p className="text-xs text-slate-600 mb-3">
          Add a price period, then click or drag on its bar to assign time slots.
        </p>
      )}

      {group.periods.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4" ref={containerRef}>
          <div style={{ minWidth: GRID_WIDTH + LABEL_COL_WIDTH + 12 }}>
            <div className="flex flex-col gap-3">
              {group.periods.map((period, pIdx) => (
                <div key={period.id}>
                  {/* Mobile: inputs + trash above the bar */}
                  <div className="mb-1.5 md:hidden flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <PeriodInputs
                        period={period} index={pIdx}
                        submitted={submitted}
                        onChange={(u) => updatePeriod(pIdx, u)}
                      />
                    </div>
                    {group.periods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePeriod(pIdx)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Remove period"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {/* Desktop: inputs column left, bar + trash right */}
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex shrink-0" style={{ width: LABEL_COL_WIDTH }}>
                      <PeriodInputs
                        period={period} index={pIdx}
                        submitted={submitted}
                        onChange={(u) => updatePeriod(pIdx, u)}
                      />
                    </div>
                    <ActivityBar
                      groupSlots={group.slots}
                      periodId={period.id}
                      onMouseDown={(s) => handleSlotMouseDown(period.id, s)}
                      onMouseEnter={handleSlotMouseEnter}
                    />
                    {/* Trash at far right of bar — desktop only */}
                    <div className="hidden md:flex shrink-0 w-6 items-center justify-center">
                      {group.periods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePeriod(pIdx)}
                          className="rounded-lg p-1 text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          title="Remove period"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 mt-2">
              <div className="hidden md:block shrink-0" style={{ width: LABEL_COL_WIDTH }} />
              <TimeAxis />
              {/* Spacer matching the trash column */}
              <div className="hidden md:block shrink-0 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Unassigned — only shown after save attempt */}
      {submitted && unassigned > 0 && group.periods.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-700/30 bg-amber-950/20 px-3 py-2.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300">
            {unassigned} slot{unassigned !== 1 ? 's' : ''} unassigned — click or drag on a period&apos;s bar to assign.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={addPeriod}
        disabled={group.periods.length >= COLOUR_PALETTE.length}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors disabled:opacity-40"
      >
        <Plus size={11} />
        Add price period
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function TariffEditor({ mode, initial, existingVersions }: Props) {
  const router = useRouter();

  const [supplierName, setSupplierName] = useState(initial.supplierName);
  const [planName, setPlanName] = useState(initial.planName);
  const [validFrom, setValidFrom] = useState(initial.validFromLocalDate);
  const [validTo, setValidTo] = useState(initial.validToLocalDate);

  const [exportRate, setExportRate] = useState(initial.exportRate);
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [standingChargeDaily, setStandingChargeDaily] = useState(initial.standingChargeAmount);
  const [standingChargeAnnual, setStandingChargeAnnual] = useState(
    () => dailyToAnnual(initial.standingChargeAmount),
  );

  const [groups, setGroups] = useState<EditorGroup[]>(() =>
    deriveGroups(initial.periods, initial.schedule),
  );

  const [submitted, setSubmitted] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'success'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dirty tracking — compare against initial values so React 18 Strict Mode's
  // double-invoke doesn't falsely mark the form dirty on mount.
  const isDirtyRef = useRef(false);
  const initialGroupsRef = useRef(groups); // stable reference to the initial groups state
  useEffect(() => {
    if (
      supplierName !== initial.supplierName ||
      planName !== initial.planName ||
      validFrom !== initial.validFromLocalDate ||
      validTo !== initial.validToLocalDate ||
      exportRate !== initial.exportRate ||
      vatRate !== initial.vatRate ||
      standingChargeDaily !== initial.standingChargeAmount ||
      groups !== initialGroupsRef.current
    ) {
      isDirtyRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, planName, validFrom, validTo, exportRate, vatRate, standingChargeDaily, groups]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  function handleDailyChange(val: string) {
    setStandingChargeDaily(val);
    setStandingChargeAnnual(dailyToAnnual(val));
  }
  function handleAnnualChange(val: string) {
    setStandingChargeAnnual(val);
    setStandingChargeDaily(annualToDaily(val));
  }

  function handleValidFromChange(val: string) {
    setValidFrom(val);
    // Default end date to 12 months out in create mode if not yet set
    if (mode === 'create' && !validTo && val) setValidTo(addMonths(val, 12));
    // If the new start date is after the current end date, clear the end date
    if (validTo && val > validTo) setValidTo('');
  }

  function updateGroup(groupId: string, updated: EditorGroup) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
  }
  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }
  function addGroup() {
    setGroups((prev) => [...prev, {
      id: newId(), days: [], periods: [], slots: new Array(SLOT_COUNT).fill(''),
    }]);
  }
  function claimDayForGroup(groupId: string, dayIdx: number) {
    setGroups((prev) => prev.map((g) => {
      if (g.id === groupId) return { ...g, days: [...g.days, dayIdx] };
      return { ...g, days: g.days.filter((d) => d !== dayIdx) };
    }));
  }
  function paintGroupSlot(groupId: string, slotIdx: number, value: string) {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId || g.slots[slotIdx] === value) return g;
      const slots = [...g.slots];
      slots[slotIdx] = value;
      return { ...g, slots };
    }));
  }

  const overlapWarning = checkOverlap(validFrom, validTo, existingVersions, initial.versionId);
  const coveredDays = new Set(groups.flatMap((g) => g.days));
  const uncoveredDays = Array.from({ length: 7 }, (_, i) => i).filter((d) => !coveredDays.has(d));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!supplierName.trim()) e.supplierName = 'required';
    if (!validFrom) e.validFrom = 'required';
    // Only require validTo once validFrom is set (it's disabled before then)
    if (validFrom && !validTo) e.validTo = 'required';
    if (validFrom && validTo && validTo < validFrom) e.validTo = 'end before start';
    if (checkOverlap(validFrom, validTo, existingVersions, initial.versionId)) e.overlap = 'overlaps existing version';
    if (exportRate === '') e.exportRate = 'required';
    if (vatRate === '') e.vatRate = 'required';
    if (standingChargeDaily === '') e.standingChargeDaily = 'required';
    if (groups.length === 0) e.groups = 'At least one schedule group is required';
    if (uncoveredDays.length > 0)
      e.coverage = `${uncoveredDays.map((d) => DAY_LABELS[d]).join(', ')} not assigned to any group`;
    groups.forEach((g, gi) => {
      // Structural group issues (days/periods/slots) are visually obvious —
      // empty pills, missing period rows, white slots in the bar. Count them
      // for gate purposes but don't add their own error keys to avoid
      // inflating the count with non-highlighted items.
      const hasNoDay = g.days.length === 0;
      const hasNoPeriod = g.periods.length === 0;
      const hasUnassigned = g.slots.some((s) => s === '');
      if (hasNoDay || hasNoPeriod || hasUnassigned) e[`g${gi}_structure`] = 'incomplete';
      g.periods.forEach((p, pi) => {
        if (!p.periodLabel.trim()) e[`g${gi}p${pi}_label`] = 'period name';
        if (!p.ratePerKwh) e[`g${gi}p${pi}_rate`] = 'period rate';
      });
    });
    return e;
  }

  const errors = submitted ? validate() : {};
  const errorCount = Object.keys(errors).length;

  function handleCancel() {
    if (isDirtyRef.current) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    router.push('/settings/tariffs');
  }

  async function handleSave() {
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(validate()).length > 0) return;

    setSaving(true);
    const { periods, weeklySchedule } = buildSavePayload(groups);

    const result = await saveTariffVersion({
      mode,
      versionId: initial.versionId,
      supplierName,
      planName,
      validFromLocalDate: validFrom,
      validToLocalDate: validTo,
      vatRate,
      exportRate,
      standingChargePerDay: standingChargeDaily,
      periods,
      weeklySchedule,
    });

    if (result.ok) {
      isDirtyRef.current = false;
      setSaveState('success');
    } else {
      setSaveError(result.error);
      setSaving(false);
    }
  }

  if (saveState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="rounded-full bg-emerald-900/40 border border-emerald-800/30 p-5 mb-6">
          <CheckCircle2 size={36} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          {mode === 'create' ? 'Tariff version added' : 'Tariff version updated'}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-8">
          Your tariff has been saved successfully.
        </p>
        <Link
          href="/settings/tariffs"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-700/80 border border-emerald-600/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Back to Tariffs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={13} />
          Tariffs
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-sm font-semibold text-slate-100">
          {mode === 'create' ? 'New tariff version' : 'Edit tariff version'}
        </span>
      </div>

      {/* 1. Tariff identity */}
      <SectionCard title="Tariff identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLS}>Supplier</label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Energia"
              className={[INPUT_BASE, ib(!!errors.supplierName)].join(' ')}
              readOnly={mode === 'edit'}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Plan name</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. Smart Meter 24h"
              className={INPUT_CLS}
              readOnly={mode === 'edit'}
            />
          </div>
        </div>

        {mode === 'edit' && (
          <p className="mt-3 text-xs text-slate-600">
            Supplier and plan name apply to all versions and cannot be changed here.
          </p>
        )}

        {/* Dates — two columns on all viewports */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLS}>Start date</label>
            <DateField
              value={validFrom}
              onChange={handleValidFromChange}
              placeholder="Pick a date"
              error={!!errors.validFrom}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>End date</label>
            <DateField
              value={validTo}
              onChange={setValidTo}
              placeholder="Pick a date"
              error={!!errors.validTo}
              disabled={!validFrom}
              minDate={validFrom || undefined}
            />
          </div>
        </div>

        {overlapWarning && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-700/30 bg-amber-950/20 px-3.5 py-3">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-300">
              This date range overlaps with{' '}
              <span className="font-medium">{overlapWarning.versionLabel}</span> (
              {overlapWarning.validFromLocalDate}
              {overlapWarning.validToLocalDate ? ` – ${overlapWarning.validToLocalDate}` : ' onwards'}
              ). Adjust the dates or update the other version first.
            </p>
          </div>
        )}
      </SectionCard>

      {/* 2. Charges */}
      <SectionCard title="Charges">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLS}>Export rate (€/kWh, VAT-inclusive)</label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={exportRate}
              onChange={(e) => { if (e.target.value !== '' && parseFloat(e.target.value) < 0) return; setExportRate(e.target.value); }}
              onKeyDown={(e) => e.key === '-' && e.preventDefault()}
              placeholder="0.1850"
              className={[INPUT_BASE, ib(!!errors.exportRate), NO_SPIN].join(' ')}
            />
            <p className="mt-1 text-xs text-slate-600">Enter 0 if you don&apos;t export.</p>
          </div>
          <div>
            <label className={LABEL_CLS}>VAT rate %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={vatRate}
              onChange={(e) => { if (e.target.value !== '' && parseFloat(e.target.value) < 0) return; setVatRate(e.target.value); }}
              onKeyDown={(e) => e.key === '-' && e.preventDefault()}
              placeholder="e.g. 9 or 8.5"
              className={[INPUT_BASE, ib(!!errors.vatRate), NO_SPIN].join(' ')}
            />
            <p className="mt-1 text-xs text-slate-600">
              Applies to imports and standing charge. Enter 0 if no VAT.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL_CLS}>Standing charge (VAT-exclusive)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Annual (€/year)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={standingChargeAnnual}
                  onChange={(e) => { if (e.target.value !== '' && parseFloat(e.target.value) < 0) return; handleAnnualChange(e.target.value); }}
                  onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                  placeholder="200.75"
                  className={[INPUT_BASE, ib(!!errors.standingChargeDaily), NO_SPIN].join(' ')}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Daily (€/day)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={standingChargeDaily}
                  onChange={(e) => { if (e.target.value !== '' && parseFloat(e.target.value) < 0) return; handleDailyChange(e.target.value); }}
                  onKeyDown={(e) => e.key === '-' && e.preventDefault()}
                  placeholder="0.5500"
                  className={[INPUT_BASE, ib(!!errors.standingChargeDaily), NO_SPIN].join(' ')}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              Enter either field — the other is calculated automatically. Enter 0 if no standing charge.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* 3. Rate schedule */}
      <SectionCard title="Rate schedule">
        <div className="flex flex-col gap-4">
          {submitted && errors.coverage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-800/40 bg-red-950/20 px-3.5 py-3">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">{errors.coverage}</p>
            </div>
          )}
          {groups.length === 0 && (
            <p className="text-sm text-slate-500 leading-relaxed">
              Add a schedule group to define which days share the same rate pattern. For example:
              Mon–Fri in one group, Sat–Sun in another.
            </p>
          )}

          {groups.map((group, gi) => (
            <div key={group.id}>
              <ScheduleGroupCard
                group={group}
                allGroups={groups}
                canDelete={groups.length > 1}
                submitted={submitted}
                onUpdate={(updated) => updateGroup(group.id, updated)}
                onDelete={() => removeGroup(group.id)}
                onClaimDay={(dayIdx) => claimDayForGroup(group.id, dayIdx)}
                onPaintSlot={(slotIdx, value) => paintGroupSlot(group.id, slotIdx, value)}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="self-start inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            <Plus size={11} />
            Add tariff schedule
          </button>

          <div className="flex items-start gap-2 rounded-xl border border-slate-800/60 bg-slate-900/30 px-3.5 py-3">
            <Info size={12} className="mt-0.5 shrink-0 text-slate-600" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Each group covers a set of days sharing the same rate pattern. Click or drag on a
              period&apos;s bar to assign half-hour slots. All 48 slots in every group must be
              assigned before saving.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Save / Cancel */}
      <div className="flex items-center justify-between gap-4 pt-2 pb-8">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}
          {submitted && errorCount > 0 && !saveError && (
            <p className="text-xs text-red-400">Fix the highlighted issues before saving</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-600/80 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-70"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Saving…' : mode === 'create' ? 'Add version' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
