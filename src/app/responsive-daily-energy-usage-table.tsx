import { useState } from 'react';
import { EnergyCalculator } from '../shared/energy-calculator';
import { formatToEuro } from '../shared/num-utils';
import { HalfHourlyPVData } from '../shared/pv-data';

export interface ResponsiveEnergyUsageTableProps {
  data: HalfHourlyPVData[];
  energyCalculator: EnergyCalculator;
}

const ResponsiveDailyEnergyUsageTable = ({ data, energyCalculator }: ResponsiveEnergyUsageTableProps): JSX.Element => {

  const [state, setState] = useState({ expanded: false });

  return (
    <div className="container responsive-energy-table small-text">
      <div className="row">
        <div className="col-3">
          <div className="fw-bold">Imported</div>
          <div className="">{energyCalculator.calculateTotalImportedKwH(data)} kWh</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Generated</div>
          <div className="">{energyCalculator.calculateTotalGeneratedKwH(data)} kWh</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Consumed</div>
          <div className="">{energyCalculator.calculateTotalConsumedKwH(data)} kWh</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Exported</div>
          <div className="">{energyCalculator.calculateTotalExportedKwH(data)} kWh</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Daily %</div>
          <div className="">{energyCalculator.calculaterTotalGreenEnergyCoverage(data)}%</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Import €</div>
          <div className="">
            {formatToEuro(energyCalculator.calculateTotalGrossImportCost(data))}&nbsp;
            {data[data.length-1]?.dayOfWeek === 'Sat' ? `(${formatToEuro(energyCalculator.calculateFreeImportGrossTotal(data))})` : ''}
          </div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Saving €</div>
          <div className="">{formatToEuro(energyCalculator.calculateTotalGrossSavings(data))}</div>
        </div>
        <div className="col-3">
          <div className="fw-bold">Export €</div>
          <div className="">{formatToEuro(energyCalculator.calculateTotalExportValue(data))}</div>
        </div>
      </div>
    </div>

  );
};

export default ResponsiveDailyEnergyUsageTable;