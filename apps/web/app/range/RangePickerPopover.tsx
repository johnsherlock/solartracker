'use client';

/**
 * Advanced range picker popover for the Range History screen.
 *
 * Shows four tabs (Custom range / Weeks / Months / Years) plus a preset strip
 * at the bottom of the Custom range tab.
 *
 * Calendar uses Sunday-start weeks (Su Mo Tu We Th Fr Sa).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type ActiveRange,
  type RangeMode,
  weekContaining,
  calendarMonthBounds,
  yearBounds,
} from '@/src/range/presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  today: string;
  earliestDate: string | null;
  activeRange: ActiveRange;
  onRangeChange: (range: ActiveRange) => void;
  onClose: () => void;
};

type Tab = 'custom' | 'weeks' | 'months' | 'years';

const TAB_LABELS: Record<Tab, string> = {
  custom: 'Custom range',
  weeks: 'Weeks',
  months: 'Months',
  years: 'Years',
};

const TABS: Tab[] = ['custom', 'weeks', 'months', 'years'];

// Day-of-week headers (Sunday-start)
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Month abbreviations
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoToDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

// Use local date components to avoid UTC offset shifting the date in UTC+ timezones.
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/** Returns the ISO date for a given year/month (0-based)/day. */
function makeIso(year: number, month: number, day: number): string {
  return dateToIso(new Date(year, month, day));
}

/**
 * Returns an array of { iso, inMonth } for the cells that make up a calendar
 * month grid (Monday-start). Cells outside the current month have inMonth=false.
 */
function buildCalendarCells(
  year: number,
  month: number,
): Array<{ iso: string; day: number; inMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // getDay(): 0=Sun, 1=Mon, …, 6=Sat
  // Sunday-start offset: Sun=0, Mon=1, …, Sat=6
  const startDow = firstDay.getDay();
  const colOffset = startDow;

  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

  // Prefix cells from previous month
  for (let i = colOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ iso: dateToIso(d), day: d.getDate(), inMonth: false });
  }

  // Cells for the current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    cells.push({ iso: makeIso(year, month, day), day, inMonth: true });
  }

  // Suffix cells to fill the last row
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({ iso: dateToIso(d), day: d.getDate(), inMonth: false });
  }

  return cells;
}

function isWeekend(iso: string): boolean {
  const dow = isoToDate(iso).getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

function decadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RangePickerPopover({
  today,
  earliestDate,
  activeRange,
  onRangeChange,
  onClose,
}: Props) {
  const todayDate = isoToDate(today);

  // Derive initial tab from active range mode
  const modeToTab = (m: RangeMode): Tab =>
    m === 'all' ? 'custom' : (m as Tab);

  const [activeTab, setActiveTab] = useState<Tab>(modeToTab(activeRange.mode));

  // Calendar navigation state (Custom + Weeks)
  const [calYear, setCalYear] = useState(() => {
    const d = isoToDate(activeRange.to);
    return d.getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const d = isoToDate(activeRange.to);
    return d.getMonth();
  });

  // Custom range: first click sets anchor, second click commits
  const [customAnchor, setCustomAnchor] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Months tab navigation
  const [monthsYear, setMonthsYear] = useState(() => {
    const d = isoToDate(activeRange.from);
    return d.getFullYear();
  });

  // Years tab navigation
  const [decStart, setDecStart] = useState(() =>
    decadeStart(isoToDate(activeRange.from).getFullYear()),
  );

  // Close on outside click / Escape
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // ---------------------------------------------------------------------------
  // Shared year/decade navigator value
  // ---------------------------------------------------------------------------
  function navigatorLabel(): string {
    if (activeTab === 'months') return String(monthsYear);
    if (activeTab === 'years') return `${decStart} – ${decStart + 9}`;
    return String(calYear);
  }

  function navigatorBack() {
    if (activeTab === 'months') {
      setMonthsYear((y) => y - 1);
    } else if (activeTab === 'years') {
      setDecStart((d) => d - 10);
    } else {
      // Custom / Weeks: step back a year
      setCalYear((y) => y - 1);
    }
  }

  function navigatorForward() {
    if (activeTab === 'months') {
      setMonthsYear((y) => y + 1);
    } else if (activeTab === 'years') {
      setDecStart((d) => d + 10);
    } else {
      setCalYear((y) => y + 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Calendar month navigation (Custom + Weeks tabs)
  // ---------------------------------------------------------------------------
  function prevCalMonth() {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  }

  function nextCalMonth() {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Custom range interactions
  // ---------------------------------------------------------------------------
  function handleCustomDayClick(iso: string) {
    if (!customAnchor) {
      setCustomAnchor(iso);
    } else {
      const from = iso < customAnchor ? iso : customAnchor;
      const to = iso < customAnchor ? customAnchor : iso;
      onRangeChange({ mode: 'custom', from, to });
      setCustomAnchor(null);
    }
  }

  function customRangePreview(): { from: string; to: string } | null {
    if (!customAnchor) return null;
    const hover = hoverDate ?? customAnchor;
    return {
      from: hover < customAnchor ? hover : customAnchor,
      to: hover < customAnchor ? customAnchor : hover,
    };
  }

  // ---------------------------------------------------------------------------
  // Weeks interactions
  // ---------------------------------------------------------------------------
  function handleWeekClick(iso: string) {
    const { from, to } = weekContaining(iso);
    onRangeChange({ mode: 'weeks', from, to });
  }

  function isInActiveWeek(iso: string): boolean {
    if (activeRange.mode !== 'weeks') return false;
    return iso >= activeRange.from && iso <= activeRange.to;
  }

  // ---------------------------------------------------------------------------
  // Cell highlight helpers
  // ---------------------------------------------------------------------------
  function isInCustomPreview(iso: string): boolean {
    const preview = customRangePreview();
    if (!preview) return false;
    return iso >= preview.from && iso <= preview.to;
  }

  function isCustomAnchor(iso: string): boolean {
    return iso === customAnchor;
  }

  function isInActiveCustomRange(iso: string): boolean {
    if (activeTab !== 'custom' || activeRange.mode !== 'custom') return false;
    if (customAnchor) return false; // mid-selection
    return iso >= activeRange.from && iso <= activeRange.to;
  }

  // ---------------------------------------------------------------------------
  // Preset strip
  // ---------------------------------------------------------------------------
  function applyPreset(label: string) {
    const d = isoToDate(today);
    switch (label) {
      case 'Today':
        onRangeChange({ mode: 'custom', from: today, to: today });
        break;
      case '7 days': {
        const from = new Date(d);
        from.setDate(d.getDate() - 6);
        onRangeChange({ mode: 'custom', from: dateToIso(from), to: today });
        break;
      }
      case '30 days': {
        const from = new Date(d);
        from.setDate(d.getDate() - 29);
        onRangeChange({ mode: 'custom', from: dateToIso(from), to: today });
        break;
      }
      case '90 days': {
        const from = new Date(d);
        from.setDate(d.getDate() - 89);
        onRangeChange({ mode: 'custom', from: dateToIso(from), to: today });
        break;
      }
      case '12 months': {
        const from = new Date(d);
        from.setDate(d.getDate() - 364);
        onRangeChange({ mode: 'custom', from: dateToIso(from), to: today });
        break;
      }
      case 'All': {
        const from = earliestDate ?? today;
        onRangeChange({ mode: 'all', from, to: today });
        break;
      }
      case 'This week': {
        const { from, to } = weekContaining(today);
        setActiveTab('weeks');
        onRangeChange({ mode: 'weeks', from, to });
        break;
      }
      case 'This month': {
        const year = d.getFullYear();
        const month = d.getMonth();
        const { from, to } = calendarMonthBounds(year, month);
        setActiveTab('months');
        onRangeChange({ mode: 'months', from, to: to > today ? today : to });
        break;
      }
      case 'This year': {
        const year = d.getFullYear();
        const { from, to } = yearBounds(year);
        setActiveTab('years');
        onRangeChange({ mode: 'years', from, to: to > today ? today : to });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const calCells = buildCalendarCells(calYear, calMonth);
  const calMonthName = new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric' }).format(
    new Date(calYear, calMonth, 1),
  );

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-full z-50 mx-auto mt-1 w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0f1a2b] shadow-2xl sm:left-auto sm:right-auto sm:w-80"
      role="dialog"
      aria-label="Date range picker"
    >
      {/* Year / decade navigator */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <button
          onClick={navigatorBack}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Previous year"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-slate-200">{navigatorLabel()}</span>
        <button
          onClick={navigatorForward}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Next year"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-800 px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-emerald-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Calendar body */}
      <div className="px-3 py-3">
        {(activeTab === 'custom' || activeTab === 'weeks') && (
          <>
            {/* Month navigator */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={prevCalMonth}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Previous month"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs font-semibold text-slate-300">{calMonthName}</span>
              <button
                onClick={nextCalMonth}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Next month"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Day of week headers */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {DOW_LABELS.map((label) => (
                <span key={label} className="text-[10px] font-semibold text-slate-600">
                  {label}
                </span>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {calCells.map((cell) => {
                const isFuture = cell.iso > today;
                const isToday = cell.iso === today;
                const weekend = isWeekend(cell.iso);

                // Active state varies by tab
                let isActive = false;
                let isRangeStart = false;
                let isRangeEnd = false;
                let isInRange = false;

                if (activeTab === 'custom') {
                  if (customAnchor) {
                    isActive = cell.iso === customAnchor;
                    isInRange = isInCustomPreview(cell.iso);
                  } else {
                    isRangeStart = cell.iso === activeRange.from && activeRange.mode === 'custom';
                    isRangeEnd = cell.iso === activeRange.to && activeRange.mode === 'custom';
                    isInRange = isInActiveCustomRange(cell.iso);
                  }
                  isActive = isActive || isCustomAnchor(cell.iso);
                } else if (activeTab === 'weeks') {
                  isActive = isInActiveWeek(cell.iso);
                  isRangeStart = cell.iso === activeRange.from && activeRange.mode === 'weeks';
                  isRangeEnd = cell.iso === activeRange.to && activeRange.mode === 'weeks';
                  isInRange = isActive;
                }

                const isEndpoint = isRangeStart || isRangeEnd || isActive;

                return (
                  <button
                    key={cell.iso}
                    disabled={isFuture}
                    onClick={() => {
                      if (activeTab === 'custom') handleCustomDayClick(cell.iso);
                      else if (activeTab === 'weeks') handleWeekClick(cell.iso);
                    }}
                    onMouseEnter={() => {
                      if (activeTab === 'custom') setHoverDate(cell.iso);
                    }}
                    onMouseLeave={() => {
                      if (activeTab === 'custom') setHoverDate(null);
                    }}
                    className={[
                      'relative flex h-7 w-full items-center justify-center text-[11px] transition-colors',
                      isFuture ? 'cursor-default opacity-25' : 'cursor-pointer',
                      isEndpoint
                        ? 'rounded-full bg-emerald-700 font-semibold text-white'
                        : isInRange
                          ? 'bg-emerald-900/50 text-slate-200'
                          : weekend
                            ? cell.inMonth ? 'text-rose-400/80 hover:bg-slate-800' : 'text-rose-400/50 hover:bg-slate-800'
                            : cell.inMonth ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800',
                      isToday && !isEndpoint ? 'font-semibold underline decoration-dotted underline-offset-2' : '',
                    ].join(' ')}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'months' && (
          <>
            {/* Month name navigator (year) */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setMonthsYear((y) => y - 1)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Previous year"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs font-semibold text-slate-300">{monthsYear}</span>
              <button
                onClick={() => setMonthsYear((y) => y + 1)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Next year"
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_ABBR.map((abbr, idx) => {
                const { from, to } = calendarMonthBounds(monthsYear, idx);
                const isFuture = from > today;
                const isSelected =
                  activeRange.mode === 'months' &&
                  activeRange.from === from;
                return (
                  <button
                    key={abbr}
                    disabled={isFuture}
                    onClick={() => {
                      if (!isFuture) {
                        onRangeChange({ mode: 'months', from, to: to > today ? today : to });
                      }
                    }}
                    className={[
                      'rounded-xl py-2 text-xs font-medium transition-colors',
                      isFuture ? 'cursor-default opacity-25 text-slate-600' : 'cursor-pointer',
                      isSelected
                        ? 'bg-emerald-700 text-white'
                        : isFuture
                          ? ''
                          : 'text-slate-300 hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {abbr}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'years' && (
          <>
            {/* Decade header */}
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setDecStart((s) => s - 10)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Previous decade"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs font-semibold text-slate-300">
                {decStart} – {decStart + 9}
              </span>
              <button
                onClick={() => setDecStart((s) => s + 10)}
                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Next decade"
              >
                <ChevronRight size={13} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => decStart + i).map((year) => {
                const { from, to } = yearBounds(year);
                const isFuture = from > today;
                const isSelected =
                  activeRange.mode === 'years' &&
                  activeRange.from.slice(0, 4) === String(year);
                return (
                  <button
                    key={year}
                    disabled={isFuture}
                    onClick={() => {
                      if (!isFuture) {
                        onRangeChange({ mode: 'years', from, to: to > today ? today : to });
                      }
                    }}
                    className={[
                      'rounded-xl py-2 text-xs font-medium transition-colors',
                      isFuture ? 'cursor-default opacity-25 text-slate-600' : 'cursor-pointer',
                      isSelected
                        ? 'bg-emerald-700 text-white'
                        : isFuture
                          ? ''
                          : 'text-slate-300 hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Preset strip — Custom range tab only */}
      {activeTab === 'custom' && (
        <div className="border-t border-slate-800 px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Today', '7 days', '30 days', '90 days',
              'This week', 'This month', 'This year',
              '12 months', 'All',
            ].map((label) => (
              <button
                key={label}
                onClick={() => applyPreset(label)}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
