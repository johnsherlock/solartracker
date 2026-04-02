/**
 * ECharts option builders for day-analysis charts.
 *
 * Each builder returns a plain ECharts option object. Keeping them here
 * (outside the component) keeps DayAnalysis.tsx focused on React concerns
 * and makes the chart configuration easy to read and adjust in isolation.
 */
import type { LivePoint, CostPoint } from './loader';
import type { SeriesKey, CostSeriesKey, ViewMode, Resolution } from './chartUtils';
import {
  SERIES_ORDER,
  SERIES_COLORS,
  COST_SERIES_ORDER,
  COST_SERIES_COLORS,
  formatSeriesLabel,
  formatCostSeriesLabel,
  formatKw,
  formatKwh,
  formatEuro,
  formatEuroTick,
} from './chartUtils';

// ---------------------------------------------------------------------------
// Shared axis / grid / tooltip theme
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

const GRID_DEFAULT = { top: 10, right: 8, bottom: 30, left: 42 };

// ---------------------------------------------------------------------------
// Gradient helpers
// ---------------------------------------------------------------------------

function areaGradient(color: string, strong: boolean) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: hexAlpha(color, strong ? 0.34 : 0.12) },
      { offset: 0.7, color: hexAlpha(color, strong ? 0.16 : 0.04) },
      { offset: 0.96, color: hexAlpha(color, 0) },
    ],
  };
}

function hexAlpha(hex: string, alpha: number): string {
  // hex is always a 6-digit hex from SERIES_COLORS
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Energy trend chart
// ---------------------------------------------------------------------------

export function buildEnergyTrendOption(
  data: LivePoint[],
  activeSeries: SeriesKey[],
  viewMode: ViewMode,
  resolution: Resolution,
  hoveredSeries: SeriesKey | null,
): object {
  const cumulativeUsesEnergyUnits = viewMode === 'cumulative' && resolution !== '1min';
  const showFill = resolution === '1min' && viewMode === 'line';

  const times = data.map((p) => p.time);

  const series = SERIES_ORDER.map((key) => {
    const color = SERIES_COLORS[key];
    const isActive = activeSeries.includes(key);
    const isHovered = hoveredSeries === key;
    const isDimmed = hoveredSeries !== null && !isHovered;
    const lineOpacity = !isActive ? 0 : isDimmed ? 0.2 : 1;
    const areaOpacity = !isActive || !showFill ? 0 : isDimmed ? 0.08 : isHovered ? 0.5 : 0.34;

    return {
      name: formatSeriesLabel(key),
      type: 'line',
      smooth: false,
      symbol: 'none',
      data: data.map((p) => p[key]),
      lineStyle: {
        color,
        width: isHovered ? 2 : key === 'import' ? 1 : 1.25,
        opacity: lineOpacity,
      },
      itemStyle: { color },
      areaStyle:
        areaOpacity > 0
          ? { color: areaGradient(color, showFill), opacity: areaOpacity }
          : { opacity: 0 },
      emphasis: { disabled: true },
    };
  });

  return {
    animation: true,
    animationDuration: 500,
    animationDurationUpdate: 500,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    animationThreshold: 10000,
    grid: GRID_DEFAULT,
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (v: number) => `${v}${cumulativeUsesEnergyUnits ? 'kWh' : 'kW'}`,
      },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
    },
    tooltip: {
      ...TOOLTIP_BASE,
      formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
        const time = params[0]?.axisValue ?? '';
        const rows = params
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;gap:16px">` +
              `<span>${p.seriesName}</span>` +
              `<span style="font-weight:600">${cumulativeUsesEnergyUnits ? formatKwh(p.value) : formatKw(p.value)}</span>` +
              `</div>`,
          )
          .join('');
        return `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${time}</div>${rows}`;
      },
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Cost / value chart
// ---------------------------------------------------------------------------

export function buildCostOption(data: CostPoint[], viewMode: ViewMode): object {
  const times = data.map((p) => p.time);

  const series = (COST_SERIES_ORDER as readonly CostSeriesKey[]).map((key) => ({
    name: formatCostSeriesLabel(key),
    type: 'line',
    smooth: false,
    symbol: 'none',
    data: data.map((p) => p[key]),
    lineStyle: { color: COST_SERIES_COLORS[key], width: 1.25 },
    itemStyle: { color: COST_SERIES_COLORS[key] },
    areaStyle: undefined,
    emphasis: { disabled: true },
  }));

  void viewMode; // viewMode transform is applied by the caller before passing data in

  return {
    animation: true,
    animationDuration: 500,
    animationDurationUpdate: 500,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    animationThreshold: 10000,
    grid: GRID_DEFAULT,
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        ...AXIS_LABEL,
        formatter: (v: number) => formatEuroTick(v),
      },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
    },
    tooltip: {
      ...TOOLTIP_BASE,
      formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
        const time = params[0]?.axisValue ?? '';
        const rows = params
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;gap:16px">` +
              `<span>${p.seriesName}</span>` +
              `<span style="font-weight:600">${formatEuro(p.value)}</span>` +
              `</div>`,
          )
          .join('');
        return `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${time}</div>${rows}`;
      },
    },
    series,
  };
}

// ---------------------------------------------------------------------------
// Solar coverage chart
// ---------------------------------------------------------------------------

export function buildCoverageOption(data: { time: string; coverage: number }[]): object {
  const COVERAGE_COLOR = '#facc15';

  return {
    animation: true,
    animationDuration: 500,
    animationDurationUpdate: 500,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    animationThreshold: 10000,
    grid: { top: 10, right: 8, bottom: 30, left: 36 },
    xAxis: {
      type: 'category',
      data: data.map((p) => p.time),
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}%` },
      axisLine: AXIS_LINE,
      axisTick: AXIS_TICK,
      splitLine: SPLIT_LINE,
    },
    tooltip: {
      ...TOOLTIP_BASE,
      formatter: (params: { value: number; axisValue: string }[]) => {
        const p = params[0];
        if (!p) return '';
        return (
          `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${p.axisValue}</div>` +
          `<div>Solar coverage <span style="font-weight:600">${p.value}%</span></div>`
        );
      },
    },
    series: [
      {
        name: 'Solar coverage',
        type: 'line',
        smooth: false,
        symbol: 'none',
        data: data.map((p) => p.coverage),
        lineStyle: { color: COVERAGE_COLOR, width: 1.2 },
        itemStyle: { color: COVERAGE_COLOR },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(251,191,36,0.2)' },
              { offset: 0.7, color: 'rgba(134,239,172,0.1)' },
              { offset: 1, color: 'rgba(134,239,172,0)' },
            ],
          },
        },
        emphasis: { disabled: true },
      },
    ],
  };
}
