import moment from 'moment';
import React, { useReducer } from 'react';
import { CalendarScale } from './lib/state-utils';
import RangeEnergyUsageLineGraph from './range-energy-usage-line-graph';
import RangeEnergyUsageStackedBarGraph from './range-energy-usage-stacked-bar-graph';
import RangeGreenEnergyPercentageLineGraph from './range-green-energy-percentage-line-graph';
import ResponsiveRangeEnergyUsageTable from './responsive-range-energy-usage-table';
import { EnergyCalculator } from '../shared/energy-calculator';
import { RangeTotals } from '../shared/pv-data';


interface MultiDayDashboardProps {
  dispatch: React.Dispatch<any>;
  startDate?: moment.Moment;
  endDate?: moment.Moment | null;
  totals?: RangeTotals;
  energyCalculator: EnergyCalculator;
  calendarScale: CalendarScale;
}

const MultiDayDashboard = ({ totals, energyCalculator, calendarScale, dispatch }: MultiDayDashboardProps): JSX.Element => {

  return (
    <div className="container dashboard">
      <div className="row">
        <div className="col">
          <div className="row">
            <div className="col">
              <ResponsiveRangeEnergyUsageTable
                totals={totals}
                energyCalculator={energyCalculator}
              />
            </div>
          </div>
          <div className="row">
            <div className="col energy-line-graph">
              <RangeEnergyUsageLineGraph
                calendarScale={calendarScale}
                view='line'
                data={totals?.rawData ?? []}
              />
            </div>
            <div className="row">
              <div className="col energy-line-graph">
                <RangeEnergyUsageStackedBarGraph
                  data={totals?.rawData ?? []}
                />
              </div>
            </div>
            <div className="row">
              <div className="col-sm-6 row-two-graph">
                <RangeGreenEnergyPercentageLineGraph data={totals?.rawData ?? []} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MultiDayDashboard;