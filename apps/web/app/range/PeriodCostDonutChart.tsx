'use client';

import { useMemo } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildPeriodCostDonutOption, type PeriodCostTotals } from '@/src/range/rangeChartOptions';

type Props = {
  totals: PeriodCostTotals;
  simplified: boolean;
  currency: string;
};

export function PeriodCostDonutChart({ totals, simplified, currency }: Props) {
  const option = useMemo(() => buildPeriodCostDonutOption(totals, currency), [totals, currency]);

  return (
    <div className="space-y-2">
      {simplified && (
        <p className="text-[10px] text-slate-500">
          Import costs estimated at day rate (time-of-use data not available for this period)
        </p>
      )}
      <EChart
        option={option}
        notMerge
        style={{ width: '100%', height: 'clamp(200px, 26vw, 260px)' }}
      />
    </div>
  );
}
