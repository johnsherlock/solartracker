/**
 * ECharts option builders for Range History energy and financial charts.
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

// containLabel: true lets ECharts fit axis labels within the padding rather
// than allocating a hardcoded 44px left margin regardless of screen width.
const GRID = { top: 38, right: 4, bottom: 56, left: 4, containLabel: true };

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

/**
 * Returns rendering hints for line/area charts based on series density.
 * Above ~90 data points the chart is dense enough on mobile that symbols
 * add visual noise and thicker lines become illegible.
 */
function lineDensityHints(seriesLength: number) {
  const dense = seriesLength > 90;
  return {
    showSymbol: !dense,
    symbolSize: dense ? 0 : 4,
    lineWidth: dense ? 1 : 2,
  };
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
  const { showSymbol, symbolSize, lineWidth } = lineDensityHints(series.length);

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
      selected: { Import: true, Generation: true, Export: true },
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
        lineStyle: { color: IMPORT_COLOR, width: lineWidth },
        itemStyle: { color: IMPORT_COLOR },
        showSymbol,
        symbolSize,
      },
      {
        name: 'Generation',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: series.map((d) => val(d, 'generatedKwh')),
        lineStyle: { color: GEN_COLOR, width: lineWidth },
        itemStyle: { color: GEN_COLOR },
        showSymbol,
        symbolSize,
      },
      {
        name: 'Export',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: series.map((d) => val(d, 'exportKwh')),
        lineStyle: { color: EXPORT_COLOR, width: lineWidth },
        itemStyle: { color: EXPORT_COLOR },
        showSymbol,
        symbolSize,
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

// ---------------------------------------------------------------------------
// Chart 3 — Per-day cost histogram
// ---------------------------------------------------------------------------

const ACTUAL_COST_COLOR = '#818cf8';    // indigo-400
const WITHOUT_SOLAR_COLOR = '#475569'; // slate-600
const EXPORT_CREDIT_COLOR = '#34d399'; // emerald-400

/**
 * Build an ECharts option for the per-day cost histogram.
 *
 * Shows actual net cost vs without-solar net cost per day, with export credit
 * as a third series. Days with no tariff (billing === null) render a zero bar.
 */
export function buildCostHistogramOption(series: RangeSeriesDay[], currency = 'EUR') {
  const dates = series.map((d) => shortDate(d.date));

  function fmt(n: number): string {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  const currencySymbol = (() => {
    try { return (0).toLocaleString('en-IE', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/[\d\s,.]/g, '').trim(); }
    catch { return currency; }
  })();

  const actualData = series.map((d) => {
    if (!d.hasSummary || !d.billing) return null;
    return round2(d.billing.actualNetCost);
  });

  const withoutSolarData = series.map((d) => {
    if (!d.hasSummary || !d.billing) return null;
    return round2(d.billing.actualNetCost + d.billing.savings);
  });

  const exportData = series.map((d) => {
    if (!d.hasSummary || !d.billing) return null;
    return round2(d.billing.exportCredit);
  });

  return {
    backgroundColor: 'transparent',
    grid: { ...GRID, bottom: 60 },
    toolbox: TOOLBOX,
    dataZoom: DATA_ZOOM,
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: 'axis' as const,
      formatter(params: { name: string; seriesName: string; value: number | null; color: string }[]) {
        const name = params[0]?.name ?? '';
        const find = (n: string) => params.find((p) => p.seriesName === n);
        const actual = find('Actual cost');
        const withoutSolar = find('Without solar');
        const exportCredit = find('Export credit');

        if (!actual?.value && !withoutSolar?.value) {
          return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${name}</div><span style="color:#475569;font-size:11px">No tariff data</span>`;
        }

        const savings = (withoutSolar?.value ?? 0) - (actual?.value ?? 0);
        const dot = (c: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px;"></span>`;

        return [
          `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${name}</div>`,
          actual ? `${dot(actual.color)}Actual: <b>${fmt(actual.value!)}</b>` : '',
          withoutSolar ? `${dot(withoutSolar.color)}Without solar: <b>${fmt(withoutSolar.value!)}</b>` : '',
          savings > 0 ? `<span style="color:#a5b4fc;font-size:11px">Solar saved ${fmt(savings)}</span>` : '',
          exportCredit?.value ? `${dot(exportCredit.color)}Export credit: <b>${fmt(exportCredit.value)}</b>` : '',
        ].filter(Boolean).join('<br>');
      },
    },
    legend: {
      top: 0,
      right: 0,
      orient: 'horizontal' as const,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 12,
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
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${currencySymbol}${v}` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
      name: currencySymbol,
      nameTextStyle: { color: '#475569', fontSize: 10 },
    },
    series: [
      {
        name: 'Without solar',
        type: 'bar',
        data: withoutSolarData,
        itemStyle: { color: WITHOUT_SOLAR_COLOR, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
      {
        name: 'Actual cost',
        type: 'bar',
        data: actualData,
        itemStyle: { color: ACTUAL_COST_COLOR, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
      {
        name: 'Export credit',
        type: 'bar',
        data: exportData,
        itemStyle: { color: EXPORT_CREDIT_COLOR, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chart 5 — Solar coverage area chart
// ---------------------------------------------------------------------------

const SOLAR_COVERAGE_COLOR = '#facc15'; // yellow-400

/**
 * Build an ECharts option for the solar coverage area chart.
 *
 * Solar coverage % = (generatedKwh - exportKwh) / consumedKwh per day.
 * Days with no summary, zero consumedKwh, or null consumedKwh emit null so
 * ECharts renders a visible break rather than interpolating.
 */
export function buildSolarCoverageOption(series: RangeSeriesDay[]) {
  const dates = series.map((d) => shortDate(d.date));
  const { showSymbol, symbolSize, lineWidth } = lineDensityHints(series.length);

  const coverageData = series.map((d) => {
    if (!d.hasSummary || !d.consumedKwh || d.consumedKwh <= 0) return null;
    const selfConsumed = d.generatedKwh - d.exportKwh;
    if (selfConsumed <= 0) return 0;
    return round2(Math.min(100, (selfConsumed / d.consumedKwh) * 100));
  });

  return {
    backgroundColor: 'transparent',
    grid: GRID,
    tooltip: {
      ...TOOLTIP_BASE,
      formatter(params: { name: string; value: number | null; color: string }[]) {
        const p = params[0];
        if (!p) return '';
        if (p.value == null) {
          return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${p.name}</div><span style="color:#475569;font-size:11px">No data</span>`;
        }
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;"></span>`;
        return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${p.name}</div>${dot}Solar coverage: <b>${p.value}%</b>`;
      },
    },
    toolbox: TOOLBOX,
    dataZoom: DATA_ZOOM,
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { ...AXIS_LABEL, interval: Math.max(0, Math.floor(series.length / 8) - 1) },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}%` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
    },
    series: [
      {
        name: 'Solar coverage',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: coverageData,
        lineStyle: { color: SOLAR_COVERAGE_COLOR, width: lineWidth },
        itemStyle: { color: SOLAR_COVERAGE_COLOR },
        showSymbol,
        symbolSize,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(250,204,21,0.22)' },
              { offset: 1, color: 'rgba(250,204,21,0.02)' },
            ],
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chart 6 — Export ratio area chart
// ---------------------------------------------------------------------------

const EXPORT_RATIO_COLOR = '#34d399'; // emerald-400

/**
 * Build an ECharts option for the export ratio area chart.
 *
 * Export ratio % = exportKwh / generatedKwh per day.
 * Days with zero or absent generation emit null (gap break).
 */
export function buildExportRatioOption(series: RangeSeriesDay[]) {
  const dates = series.map((d) => shortDate(d.date));
  const { showSymbol, symbolSize, lineWidth } = lineDensityHints(series.length);

  const ratioData = series.map((d) => {
    if (!d.hasSummary || d.generatedKwh <= 0) return null;
    return round2(Math.min(100, (d.exportKwh / d.generatedKwh) * 100));
  });

  return {
    backgroundColor: 'transparent',
    grid: GRID,
    tooltip: {
      ...TOOLTIP_BASE,
      formatter(params: { name: string; value: number | null; color: string }[]) {
        const p = params[0];
        if (!p) return '';
        if (p.value == null) {
          return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${p.name}</div><span style="color:#475569;font-size:11px">No generation data</span>`;
        }
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px;"></span>`;
        return `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${p.name}</div>${dot}Export ratio: <b>${p.value}%</b>`;
      },
    },
    toolbox: TOOLBOX,
    dataZoom: DATA_ZOOM,
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: { ...AXIS_LABEL, interval: Math.max(0, Math.floor(series.length / 8) - 1) },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}%` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
    },
    series: [
      {
        name: 'Export ratio',
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: ratioData,
        lineStyle: { color: EXPORT_RATIO_COLOR, width: lineWidth },
        itemStyle: { color: EXPORT_RATIO_COLOR },
        showSymbol,
        symbolSize,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(52,211,153,0.22)' },
              { offset: 1, color: 'rgba(52,211,153,0.02)' },
            ],
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chart 4 — Period cost breakdown donut
// ---------------------------------------------------------------------------

export type PeriodCostTotals = {
  importCost: number;
  fixedCharges: number;
  exportCredit: number;
  savings: number;
};

const DONUT_IMPORT_COLOR = '#818cf8';   // indigo-400
const DONUT_FIXED_COLOR = '#94a3b8';    // slate-400
const DONUT_EXPORT_COLOR = '#34d399';   // emerald-400
const DONUT_SAVINGS_COLOR = '#a5b4fc';  // indigo-300
const DONUT_FREE_COLOR = '#1e293b';     // slate-800 (inactive placeholder)

/**
 * Build an ECharts option for the period cost breakdown donut chart.
 */
export function buildPeriodCostDonutOption(totals: PeriodCostTotals, currency = 'EUR') {
  const { importCost, fixedCharges, exportCredit, savings } = totals;

  const fmt = (n: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const data = [
    { value: Math.max(0, importCost), name: 'Import cost', itemStyle: { color: DONUT_IMPORT_COLOR } },
    { value: Math.max(0, fixedCharges), name: 'Fixed charges', itemStyle: { color: DONUT_FIXED_COLOR } },
    { value: Math.max(0, exportCredit), name: 'Export credit', itemStyle: { color: DONUT_EXPORT_COLOR } },
    { value: Math.max(0, savings), name: 'Solar savings', itemStyle: { color: DONUT_SAVINGS_COLOR } },
    {
      value: 0.001, // near-zero so it renders as a thin slice placeholder
      name: 'Free import',
      itemStyle: { color: DONUT_FREE_COLOR },
      label: { show: false },
      emphasis: { disabled: true },
    },
  ];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: 'item' as const,
      formatter(param: { name: string; value: number; percent: number; color: string }) {
        if (param.name === 'Free import') {
          return `<div style="font-size:11px;color:#94a3b8">Free import<br><span style="color:#475569">Not active</span></div>`;
        }
        const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${param.color};margin-right:5px;"></span>`;
        return `${dot}${param.name}: <b>${fmt(param.value)}</b> (${param.percent}%)`;
      },
    },
    legend: {
      orient: 'vertical' as const,
      right: 0,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 10,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      formatter(name: string) {
        if (name === 'Free import') return 'Free import (not active)';
        const item = data.find((d) => d.name === name);
        if (!item || item.value < 0.01) return name;
        return `${name}  ${fmt(item.value)}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold', color: '#e2e8f0' },
          scale: true,
          scaleSize: 6,
        },
        data,
      },
    ],
  };
}
