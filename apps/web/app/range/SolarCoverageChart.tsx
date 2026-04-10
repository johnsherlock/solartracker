'use client';

import { useEffect, useMemo, useRef } from 'react';
import type EChartsReact from 'echarts-for-react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildSolarCoverageOption } from '@/src/range/rangeChartOptions';
import { registerChart, broadcastDataZoom } from '@/src/range/chartSync';
import type { RangeSeriesDay } from '@/src/range/types';

const CHART_GROUP = 'range-history';

type Props = {
  series: RangeSeriesDay[];
};

export function SolarCoverageChart({ series }: Props) {
  const chartRef = useRef<EChartsReact>(null);
  const option = useMemo(() => buildSolarCoverageOption(series), [series]);

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

    return () => {
      unregister();
      instance.off('dataZoom', handleDataZoom);
    };
  }, []);

  return (
    <EChart
      ref={chartRef}
      option={option}
      notMerge
      style={{ width: '100%', height: 'clamp(200px, 24vw, 260px)' }}
    />
  );
}
