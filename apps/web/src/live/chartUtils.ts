import type { LivePoint, CostPoint } from './loader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Resolution = '1min' | '30min' | '1hour';
export type ViewMode = 'line' | 'cumulative';
export type SeriesKey = 'generation' | 'consumption' | 'import' | 'export' | 'immersion';
export type CostSeriesKey = 'importCost' | 'savings' | 'exportCredit';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SERIES_ORDER: SeriesKey[] = [
  'generation',
  'consumption',
  'import',
  'immersion',
  'export',
];

export const MINUTE_DEFAULT_SERIES: SeriesKey[] = ['generation', 'consumption'];

export const SERIES_COLORS: Record<SeriesKey, string> = {
  generation: '#fbbf24',
  consumption: '#f97316',
  import: '#64748b',
  export: '#34d399',
  immersion: '#ef4444',
};

export const COST_SERIES_ORDER: readonly CostSeriesKey[] = [
  'importCost',
  'savings',
  'exportCredit',
];

export const COST_SERIES_COLORS: Record<CostSeriesKey, string> = {
  importCost: '#f472b6',
  savings: '#4ade80',
  exportCredit: '#60a5fa',
};

// ---------------------------------------------------------------------------
// Data transforms
// ---------------------------------------------------------------------------

export function applyViewMode(
  data: LivePoint[],
  viewMode: ViewMode,
  resolution: Resolution,
): LivePoint[] {
  if (viewMode === 'line') return data;

  const running = { generation: 0, consumption: 0, import: 0, export: 0, immersion: 0 };
  return data.map((point) => {
    const factor = resolution === '1min' ? 1 : point.intervalHours;
    running.generation += point.generation * factor;
    running.consumption += point.consumption * factor;
    running.import += point.import * factor;
    running.export += point.export * factor;
    running.immersion += point.immersion * factor;
    return {
      time: point.time,
      generation: Number(running.generation.toFixed(2)),
      consumption: Number(running.consumption.toFixed(2)),
      import: Number(running.import.toFixed(2)),
      export: Number(running.export.toFixed(2)),
      immersion: Number(running.immersion.toFixed(2)),
      intervalHours: point.intervalHours,
    };
  });
}

export function applyCostViewMode(data: CostPoint[], viewMode: ViewMode): CostPoint[] {
  if (viewMode === 'line') return data;

  const running = { importCost: 0, savings: 0, exportCredit: 0 };
  return data.map((point) => {
    running.importCost += point.importCost;
    running.savings += point.savings;
    running.exportCredit += point.exportCredit;
    return {
      time: point.time,
      importCost: Number(running.importCost.toFixed(2)),
      savings: Number(running.savings.toFixed(2)),
      exportCredit: Number(running.exportCredit.toFixed(2)),
    };
  });
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatSeriesLabel(key: SeriesKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatCostSeriesLabel(key: CostSeriesKey): string {
  if (key === 'importCost') return 'Import €';
  if (key === 'exportCredit') return 'Export €';
  return 'Savings €';
}

export function formatResolutionLabel(value: Resolution): string {
  if (value === '1min') return '1min';
  if (value === '30min') return '30min';
  return '1hour';
}

export function formatKw(value: number): string {
  return `${value.toFixed(2)} kW`;
}

export function formatW(kw: number): string {
  return Math.round(kw * 1000).toLocaleString();
}

export function formatKwh(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

export function formatEuro(value: number, preserveSign = false): string {
  const sign = preserveSign && value < 0 ? '-' : '';
  return `${sign}€${Math.abs(value).toFixed(2)}`;
}

export function formatEuroTick(value: number): string {
  if (value === 0) return '€0';
  return `€${value.toFixed(2)}`;
}

export function formatClockTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfMonth(isoDate: string): Date {
  const date = parseIsoDate(isoDate);
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function shiftMonth(isoDate: string, months: number): string {
  const date = startOfMonth(isoDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function formatMonthYear(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDate(isoDate));
}

export function getMonthName(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IE', { month: 'long' }).format(parseIsoDate(isoDate));
}

export function getMonthDays(
  visibleMonth: string,
): { iso: string; dayNumber: number; inMonth: boolean }[] {
  const monthStart = startOfMonth(visibleMonth);
  const month = monthStart.getMonth();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      iso: date.toISOString().slice(0, 10),
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}
