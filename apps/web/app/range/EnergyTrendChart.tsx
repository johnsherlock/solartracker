'use client';

import { useMemo } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildEnergyTrendOption } from '@/src/range/rangeChartOptions';
import type { RangeSeriesDay } from '@/src/range/types';

type Props = {
  series: RangeSeriesDay[];
};

export function EnergyTrendChart({ series }: Props) {
  const option = useMemo(() => buildEnergyTrendOption(series), [series]);

  return (
    <EChart
      option={option}
      notMerge
      style={{ width: '100%', height: 'clamp(200px, 28vw, 260px)' }}
    />
  );
}
