import { useState } from 'react';
import { EnergyCalculator } from '../shared/energy-calculator';
import { calculateGreenEnergyPercentage } from '../shared/energy-utils';
import { formatToEuro } from '../shared/num-utils';
import * as numUtils from '../shared/num-utils';
import { RangeTotals } from '../shared/pv-data';

export interface ResponsiveRangeEnergyUsageTableProps {
  totals?: RangeTotals;
  energyCalculator: EnergyCalculator;
}

const ResponsiveRangeEnergyUsageTable = ({ totals, energyCalculator }: ResponsiveRangeEnergyUsageTableProps): JSX.Element => {

  const [state, setState] = useState({ expanded: false });

  return (
    <div className="container responsive-energy-table small-text">
      <div className="row">
        <div className="col">
          <div className="fw-bold">Day Imp</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.dayImpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Peak Imp</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.peakImpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Night Imp</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.nightImpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Free Imp</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.freeImpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Total Imported</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.combinedImpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Generated</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.genTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Consumed</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.conpTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Exported</div>
          <div className="">{numUtils.formatDecimal(totals?.aggregatedData?.expTotal)} kWh</div>
        </div>
        <div className="col">
          <div className="fw-bold">Daily %</div>
          <div className="">{calculateGreenEnergyPercentage(totals?.aggregatedData?.combinedImpTotal, totals?.aggregatedData?.conpTotal)}%</div>
        </div>
        <div className="col">
          <div className="fw-bold">Import €</div>
          <div className="">
            {energyCalculator.calculateGrossImportTotalForRange(totals)}
          </div>
        </div>
        <div className="col">
          <div className="fw-bold">Saving €</div>
          <div className="">{formatToEuro(totals?.aggregatedData?.grossSavingTotal)}</div>
        </div>
        <div className="col">
          <div className="fw-bold">Export €</div>
          <div className="">{formatToEuro(energyCalculator.calculateExportValue(totals?.aggregatedData?.expTotal))}</div>
        </div>
      </div>
    </div>

  );
};

export default ResponsiveRangeEnergyUsageTable;