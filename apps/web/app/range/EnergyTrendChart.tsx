'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type EChartsReact from 'echarts-for-react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildEnergyTrendOption } from '@/src/range/rangeChartOptions';
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
    echarts.connect(CHART_GROUP);
    // Defer so echarts-for-react's own init effect completes first.
    const id = setTimeout(() => {
      chartRef.current?.getEchartsInstance()?.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
    }, 50);
    return () => clearTimeout(id);
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
