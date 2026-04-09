/**
 * ECharts option builders for Range History energy charts.
 *
 * Keeping these outside the React components makes the chart config easy to
 * read, test, and adjust in isolation.
 */
import type { RangeSeriesDay } from './types';

// ---------------------------------------------------------------------------
// Shared theme constants (consistent with live/echartsOptions.ts)
// ---------------------------------------------------------------------------

const AXIS_LABEL = { color: '#64748b', fontSize: 11 };
const AXIS_LINE = { show: false };
const AXIS_TICK = { show: false };
const SPLIT_LINE = { lineStyle: { color: 'rgba(51,65,85,0.28)' } };

const TOOLTIP_BASE = {
  trigger: 'axis' as const,
  backgroundColor: '#0f172a',
  borderColor: 'rgba(71,85,105,0.55)',
  borderWidth: 1,
  textStyle: { color: '#e2e8f0', fontSize: 12 },
  extraCssText: 'border-radius:16px;padding:10px 14px;',
};

const GRID = { top: 38, right: 12, bottom: 56, left: 44 };

const DATA_ZOOM = [
  {
    type: 'inside',
    xAxisIndex: 0,
    filterMode: 'filter' as const,
  },
  {
    type: 'slider',
    xAxisIndex: 0,
    filterMode: 'filter' as const,
    height: 18,
    bottom: 4,
    borderColor: 'rgba(51,65,85,0.4)',
    backgroundColor: 'rgba(15,23,42,0.5)',
    fillerColor: 'rgba(16,185,129,0.12)',
    handleStyle: { color: '#10b981', borderColor: '#10b981' },
    moveHandleStyle: { color: '#10b981' },
    textStyle: { color: '#475569', fontSize: 9 },
    showDetail: false,
  },
];

// Toolbox: zoom-select icon only (back/undo hidden via empty path), stacked
// below the legend in the top-right so there is no overlap.
const TOOLBOX = {
  right: 8,
  top: 18,
  itemSize: 13,
  iconStyle: { borderColor: '#475569', borderWidth: 1.5, color: 'transparent' },
  emphasis: { iconStyle: { borderColor: '#94a3b8', color: 'transparent' } },
  feature: {
    dataZoom: {
      yAxisIndex: 'none',
      title: { zoom: 'Select range', back: '' },
      icon: {
        // back icon set to empty path so only the zoom icon is visible
        back: 'path://',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const IMPORT_COLOR = '#60a5fa';   // blue-400
const GEN_COLOR = '#facc15';     // yellow-400
const EXPORT_COLOR = '#34d399';  // emerald-400

// Per-day bar colours
const DAY_BAND_COLOR = '#818cf8';   // indigo-400
const NIGHT_BAND_COLOR = '#a78bfa'; // violet-400
const PEAK_BAND_COLOR = '#f472b6';  // pink-400

const GEN_CONSUMED_COLOR = '#facc15'; // yellow-400
const GEN_EXPORTED_COLOR = '#34d399'; // emerald-400
const GEN_IMMERSION_COLOR = '#2dd4bf'; // teal-400

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Chart 1 — Energy trend line
// ---------------------------------------------------------------------------

/**
 * Build an ECharts option for the energy trend line chart.
 *
 * Data gaps (hasSummary === false) are emitted as `null` so ECharts renders
 * a visible break rather than interpolating across missing days.
 */
export function buildEnergyTrendOption(series: RangeSeriesDay[]) {
  const dates = series.map((d) => shortDate(d.date));

  function val(d: RangeSeriesDay, key: 'importKwh' | 'generatedKwh' | 'exportKwh') {
    return d.hasSummary ? round2(d[key]) : null;
  }

  return {
    backgroundColor: 'transparent',
    grid: GRID,
    tooltip: {
      ...TOOLTIP_BASE,
      formatter(params: { name: string; seriesName: string; value: number | null; color: string }[]) {
        const name = params[0]?.name ?? '';
        const lines = params
          .filter((p) => p.value != null)
          .map(
            (p) =>
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;"></span>${p.seriesName}: <b>${p.value} kWh</b>`,
          );
        const header = `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${name}</div>`;
        if (lines.length === 0) {
          return `${header}<span style="color:#475569;font-size:11px">No data recorded for ${name}</span>`;
        }
        return `${header}${lines.join('<br>')}`;
      },
    },
    legend: {
      top: 0,
      right: 0,
      orient: 'horizontal' as const,
      itemWidth: 14,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      selected: { Import: true, Generation: true, Export: false },
    },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { ...AXIS_LABEL, interval: Math.max(0, Math.floor(series.length / 8) - 1) },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
      name: 'kWh',
      nameTextStyle: { color: '#475569', fontSize: 10 },
    },
    toolbox: TOOLBOX,
    dataZoom: DATA_ZOOM,
    series: [
      {
        name: 'Import',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: series.map((d) => val(d, 'importKwh')),
        lineStyle: { color: IMPORT_COLOR, width: 2 },
        itemStyle: { color: IMPORT_COLOR },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: 'Generation',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: series.map((d) => val(d, 'generatedKwh')),
        lineStyle: { color: GEN_COLOR, width: 2 },
        itemStyle: { color: GEN_COLOR },
        symbol: 'circle',
        symbolSize: 4,
      },
      {
        name: 'Export',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: series.map((d) => val(d, 'exportKwh')),
        lineStyle: { color: EXPORT_COLOR, width: 2, type: 'dashed' },
        itemStyle: { color: EXPORT_COLOR },
        symbol: 'circle',
        symbolSize: 4,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chart 2 — Per-day stacked bar
// ---------------------------------------------------------------------------

/**
 * Build an ECharts option for the per-day stacked bar chart.
 *
 * Group 1 (stack "import"): total import, or day/peak/night bands when
 * hasBandData is true.
 *
 * Group 2 (stack "gen"): gen consumed + exported + immersion diverted.
 *
 * The redundant overall-gen bar from v1 is intentionally absent.
 */
export function buildPerDayBarOption(series: RangeSeriesDay[], hasBandData: boolean) {
  const dates = series.map((d) => shortDate(d.date));

  // Only include days that have a summary; gaps get zero values and are visually
  // absent because all stacked values will be 0.
  function safeVal(d: RangeSeriesDay, key: keyof RangeSeriesDay): number {
    if (!d.hasSummary) return 0;
    const v = d[key];
    return typeof v === 'number' ? round2(v) : 0;
  }

  // Gen consumed = generated - exported - immersion diverted (floor at 0)
  function genConsumed(d: RangeSeriesDay): number {
    if (!d.hasSummary) return 0;
    const consumed = d.generatedKwh - d.exportKwh - (d.immersionDivertedKwh ?? 0);
    return round2(Math.max(0, consumed));
  }

  const importSeries = hasBandData
    ? [
        {
          name: 'Import (day)',
          type: 'bar',
          stack: 'import',
          data: series.map((d) => {
            if (!d.hasSummary) return 0;
            return round2(d.dayImportKwh ?? 0);
          }),
          itemStyle: { color: DAY_BAND_COLOR },
          barMaxWidth: 20,
        },
        {
          name: 'Import (night)',
          type: 'bar',
          stack: 'import',
          data: series.map((d) => {
            if (!d.hasSummary) return 0;
            return d.nightImportKwh != null ? round2(d.nightImportKwh) : 0;
          }),
          itemStyle: { color: NIGHT_BAND_COLOR },
          barMaxWidth: 20,
        },
        {
          name: 'Import (peak)',
          type: 'bar',
          stack: 'import',
          data: series.map((d) => {
            if (!d.hasSummary) return 0;
            return d.peakImportKwh != null ? round2(d.peakImportKwh) : 0;
          }),
          itemStyle: { color: PEAK_BAND_COLOR },
          barMaxWidth: 20,
        },
      ]
    : [
        {
          name: 'Import',
          type: 'bar',
          stack: 'import',
          data: series.map((d) => safeVal(d, 'importKwh')),
          itemStyle: { color: IMPORT_COLOR },
          barMaxWidth: 20,
        },
      ];

  const genSeries = [
    {
      name: 'Gen consumed',
      type: 'bar',
      stack: 'gen',
      data: series.map(genConsumed),
      itemStyle: { color: GEN_CONSUMED_COLOR },
      barMaxWidth: 20,
    },
    {
      name: 'Exported',
      type: 'bar',
      stack: 'gen',
      data: series.map((d) => safeVal(d, 'exportKwh')),
      itemStyle: { color: GEN_EXPORTED_COLOR },
      barMaxWidth: 20,
    },
    {
      name: 'Immersion',
      type: 'bar',
      stack: 'gen',
      data: series.map((d) => safeVal(d, 'immersionDivertedKwh')),
      itemStyle: { color: GEN_IMMERSION_COLOR },
      barMaxWidth: 20,
    },
  ];

  return {
    backgroundColor: 'transparent',
    grid: { ...GRID, bottom: 60 },
    toolbox: TOOLBOX,
    dataZoom: DATA_ZOOM,
    tooltip: {
      ...TOOLTIP_BASE,
      formatter(params: { name: string; seriesName: string; value: number; color: string }[]) {
        const name = params[0]?.name ?? '';
        const lines = params
          .filter((p) => p.value > 0)
          .map(
            (p) =>
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;"></span>${p.seriesName}: <b>${p.value} kWh</b>`,
          );
        return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${name}</div>${lines.join('<br>')}`;
      },
    },
    legend: {
      top: 0,
      right: 0,
      orient: 'horizontal' as const,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { color: '#94a3b8', fontSize: 10 },
    },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { ...AXIS_LABEL, interval: Math.max(0, Math.floor(series.length / 8) - 1) },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
      name: 'kWh',
      nameTextStyle: { color: '#475569', fontSize: 10 },
    },
    series: [...importSeries, ...genSeries],
  };
}
