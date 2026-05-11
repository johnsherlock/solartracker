'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type EChartsReact from 'echarts-for-react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildCostHistogramOption } from '@/src/range/rangeChartOptions';
import { registerChart, broadcastDataZoom } from '@/src/range/chartSync';
import type { RangeSeriesDay } from '@/src/range/types';

const CHART_GROUP = 'range-history';

type Props = {
  series: RangeSeriesDay[];
  currency: string;
};

export function CostHistogramChart({ series, currency }: Props) {
  const chartRef = useRef<EChartsReact>(null);
  const [selectedSeries, setSelectedSeries] = useState<Record<string, boolean>>({
    'Without solar': true,
    'Actual cost': true,
    'Export credit': true,
  });
  const option = useMemo(
    () => buildCostHistogramOption(series, currency, selectedSeries),
    [series, currency, selectedSeries],
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
    <EChart
      ref={chartRef}
      option={option}
      notMerge
      style={{ width: '100%', height: 'clamp(220px, 28vw, 280px)' }}
      onEvents={{
        legendselectchanged: (event) => {
          setSelectedSeries(event.selected as Record<string, boolean>);
        },
      }}
    />
  );
}
