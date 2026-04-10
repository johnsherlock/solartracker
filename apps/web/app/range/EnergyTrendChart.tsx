'use client';

import { useEffect, useMemo, useRef } from 'react';
import type EChartsReact from 'echarts-for-react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildEnergyTrendOption } from '@/src/range/rangeChartOptions';
import { registerChart, broadcastDataZoom } from '@/src/range/chartSync';
import type { RangeSeriesDay } from '@/src/range/types';

const CHART_GROUP = 'range-history';

type Props = {
  series: RangeSeriesDay[];
};

export function EnergyTrendChart({ series }: Props) {
  const chartRef = useRef<EChartsReact>(null);
  const option = useMemo(() => buildEnergyTrendOption(series), [series]);

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
    <EChart
      ref={chartRef}
      option={option}
      notMerge
      style={{ width: '100%', height: 'clamp(220px, 28vw, 280px)' }}
    />
  );
}
