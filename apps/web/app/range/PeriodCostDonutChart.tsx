'use client';

import { useMemo } from 'react';
import { EChart } from '@/src/live/EChartsWrapper';
import { buildPeriodCostDonutOption, PERIOD_COST_COLORS, type PeriodCostTotals } from '@/src/range/rangeChartOptions';

type Props = {
  totals: PeriodCostTotals;
  simplified: boolean;
  currency: string;
};

export function PeriodCostDonutChart({ totals, simplified, currency }: Props) {
  const option = useMemo(() => buildPeriodCostDonutOption(totals, currency), [totals, currency]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const { importCost, fixedCharges, exportCredit = 0, savings = 0, freeImportValue = 0, freeImportKwh = 0, avgPaidRate = 0 } = totals;
  const grossBill = importCost + fixedCharges;
  const netBill = grossBill - exportCredit;
  const hasExport = exportCredit > 0;
  const hasSavings = savings > 0;
  const hasFreeImport = freeImportValue > 0;

  return (
    <div className="space-y-2">
      {simplified && (
        <p className="text-[10px] text-slate-500">
          Import costs estimated at day rate (time-of-use data not available for this period)
        </p>
      )}

      {/* Two-column layout: donut left, legend + summary right */}
      {/* h-[220px] gives EChart a concrete ancestor height so height:100% works without inflating the card */}
      <div className="flex items-stretch gap-4">
        {/* Donut — minHeight gives EChart a concrete px anchor so height:100% works */}
        <div className="shrink-0 w-[55%]" style={{ minHeight: '280px' }}>
          <EChart
            option={option}
            notMerge
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Right panel: legend + summary, centred vertically */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3">
          {/* HTML legend */}
          <div className="space-y-1.5">
            {([
              { color: PERIOD_COST_COLORS.importCost, label: 'Import cost', value: importCost },
              { color: PERIOD_COST_COLORS.fixedCharges, label: 'Fixed charges', value: fixedCharges },
            ] as const).map(({ color, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="text-[11px] text-slate-400 flex-1">{label}</span>
                <span className="text-[11px] font-mono text-slate-300">{fmt(value)}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-1 border-t border-slate-800/60 pt-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Gross bill</span>
              <span className="font-mono text-slate-300">{fmt(grossBill)}</span>
            </div>
            {hasExport && (
              <div className="flex justify-between">
                <span className="text-slate-400">Net bill <span className="text-slate-500">−{fmt(exportCredit)} export</span></span>
                <span className="font-mono text-slate-300">{fmt(netBill)}</span>
              </div>
            )}
            {hasSavings && (
              <p className="text-slate-500">solar savings <span className="text-slate-400">{fmt(savings)}</span> est.</p>
            )}
            {hasFreeImport && (
              <p className="text-slate-500">
                free import <span className="text-slate-400">~{fmt(freeImportValue)}</span> est.
                <span className="ml-1 text-slate-600">({freeImportKwh.toFixed(1)} kWh @ avg. {fmt(avgPaidRate)}/kWh)</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
