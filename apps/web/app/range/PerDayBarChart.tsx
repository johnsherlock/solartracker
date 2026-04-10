'use client';

import { useEffect, useMemo, useRef } from 'react';
import type EChartsReact from 'echarts-for-react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildPerDayBarOption } from '@/src/range/rangeChartOptions';
import { registerChart, broadcastDataZoom } from '@/src/range/chartSync';
import type { RangeSeriesDay } from '@/src/range/types';

const CHART_GROUP = 'range-history';

type Props = {
  series: RangeSeriesDay[];
};

export function PerDayBarChart({ series }: Props) {
  const chartRef = useRef<EChartsReact>(null);
  const summaryDays = series.filter((d) => d.hasSummary);
  const hasBandData = summaryDays.length > 0 && summaryDays.every((d) => d.dayImportKwh != null);
  const option = useMemo(
    () => buildPerDayBarOption(series, hasBandData),
    [series, hasBandData],
  );

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    instance.group = CHART_GROUP;
    const unregister = registerChart(CHART_GROUP, instance);

    const handleDataZoom = (params: any) => {
      const batch = params.batch?.[0];
      const start = params.start ?? batch?.start;
      const end = params.end ?? batch?.end;
      if (start != null && end != null) broadcastDataZoom(CHART_GROUP, instance, start, end);
    };
    instance.on('dataZoom', handleDataZoom);

    const id = setTimeout(() => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
    }, 50);

    return () => {
      unregister();
      instance.off('dataZoom', handleDataZoom);
      clearTimeout(id);
    };
  }, []);

  return (
    <div className="space-y-1">
      {!hasBandData && (
        <p className="text-[10px] text-slate-600">
          Import shown as total — rate-band breakdown unavailable for this period
        </p>
      )}
      <EChart
        ref={chartRef}
        option={option}
        notMerge
        style={{ width: '100%', height: 'clamp(220px, 28vw, 280px)' }}
      />
    </div>
  );
}
