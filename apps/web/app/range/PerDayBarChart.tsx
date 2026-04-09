'use client';

import { useMemo } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildPerDayBarOption } from '@/src/range/rangeChartOptions';
import type { RangeSeriesDay } from '@/src/range/types';

type Props = {
  series: RangeSeriesDay[];
};

export function PerDayBarChart({ series }: Props) {
  const summaryDays = series.filter((d) => d.hasSummary);
  const hasBandData = summaryDays.length > 0 && summaryDays.every((d) => d.dayImportKwh != null);
  const option = useMemo(
    () => buildPerDayBarOption(series, hasBandData),
    [series, hasBandData],
  );

  return (
    <div className="space-y-1">
      {!hasBandData && (
        <p className="text-[10px] text-slate-600">
          Import shown as total — rate-band breakdown unavailable for this period
        </p>
      )}
      <EChart
        option={option}
        notMerge
        style={{ width: '100%', height: 'clamp(200px, 28vw, 260px)' }}
      />
    </div>
  );
}
