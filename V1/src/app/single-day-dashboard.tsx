import moment from 'moment';
import React, { useReducer } from 'react';
import DailyEnergyTierDoughnutChart from './daily-energy-tier-doughnut-chart';
import DailyEnergyUsageTable from './daily-energy-usage-table';
import EnergyCostLineGraph, { View } from './energy-cost-line-graph';
import EnergyUsageLineGraph, { Scale } from './energy-usage-line-graph';
import GreenEnergyPercentageLineGraph from './green-energy-percentage-line-graph';
import { CalendarScale } from './lib/state-utils';
import LiveEnergyBarGraph from './live-energy-bar-graph';
import OptionLink from './option-link';
import ResponsiveDailyEnergyUsageTable from './responsive-daily-energy-usage-table';
import { EnergyCalculator } from '../shared/energy-calculator';
import { MinutePVData, HalfHourlyPVData, HourlyPVData, Totals } from '../shared/pv-data';

interface SingleDayDashboardProps {
  dispatch: React.Dispatch<any>;
  selectedDate: moment.Moment;
  startDate?: moment.Moment;
  endDate?: moment.Moment | null;
  today: moment.Moment;
  minuteData: MinutePVData[];
  halfHourData: HalfHourlyPVData[];
  hourData: HourlyPVData[];
  energyCalculator: EnergyCalculator;
  energyUsageLineGraphScale: Scale;
  energyUsageLineGraphView: View;
  calendarScale: CalendarScale;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToDay: (date: Date | [Date | null, Date | null]) => void;
}

const SingleDayDashboard = (
  {
    selectedDate, today, minuteData, halfHourData, hourData, energyCalculator, goToPreviousDay, goToNextDay, goToDay,
    energyUsageLineGraphScale, energyUsageLineGraphView, dispatch,
  }:
  SingleDayDashboardProps): JSX.Element => {

  // const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const isToday = selectedDate.isSame(today);

  return (
    <div className="container dashboard">
      <div className="row">
        <div className="col">
          <div className="row d-lg-block d-none">
            <div className="col">
              <DailyEnergyUsageTable
                data={halfHourData}
                energyCalculator={energyCalculator}
              />
            </div>
          </div>
          <div className="row d-lg-none">
            <div className="col">
              <ResponsiveDailyEnergyUsageTable
                data={halfHourData}
                energyCalculator={energyCalculator}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-3">
              <span className="title">Scale:</span>&nbsp;
              <OptionLink dispatch={dispatch} type="SET_SCALE" payload="hour" selected={energyUsageLineGraphScale === 'hour'} text="Hour" />&nbsp;|&nbsp;
              <OptionLink dispatch={dispatch} type="SET_SCALE" payload="halfHour" selected={energyUsageLineGraphScale === 'halfHour'} text="Half Hour" />&nbsp;|&nbsp;
              <OptionLink dispatch={dispatch} type="SET_SCALE" payload="minute" selected={energyUsageLineGraphScale === 'minute'} text="Minute" />
            </div>
            <div className="col-md-3">
              <span className="title">View:</span>&nbsp;
              <OptionLink dispatch={dispatch} type="SET_VIEW" payload="line" selected={energyUsageLineGraphView === 'line'} text="Line" />&nbsp;|&nbsp;
              <OptionLink dispatch={dispatch} type="SET_VIEW" payload="cumulative" selected={energyUsageLineGraphView === 'cumulative'} text="Cumulative Line" />
            </div>
          </div>
          <div className="row">
            <div className={isToday ? 'col energy-line-graph' : 'col-12 energy-line-graph'}>
              <EnergyUsageLineGraph
                scale={energyUsageLineGraphScale}
                view={energyUsageLineGraphView}
                minutePvData={minuteData}
                halfHourPvData={halfHourData}
                hourlyPvData={hourData}
              />
            </div>
            {isToday ? (
              <div className="col energy-line-graph">
                <EnergyCostLineGraph
                  view={energyUsageLineGraphView}
                  halfHourPvData={halfHourData}
                  hourlyPvData={hourData}
                  energyCalculator={energyCalculator}
                />
              </div>
            ) : null}
          </div>
          <div className='row'>
            {!isToday ? (
              <div className="col-sm-6 row-two-graph">
                <EnergyCostLineGraph
                  view={energyUsageLineGraphView}
                  halfHourPvData={halfHourData}
                  hourlyPvData={hourData}
                  energyCalculator={energyCalculator}
                />
              </div>
            ) : null}
            <div className="col-sm-6 row-two-graph">
              <GreenEnergyPercentageLineGraph
                scale={energyUsageLineGraphScale}
                minutePvData={minuteData}
                halfHourPvData={halfHourData}
                hourlyPvData={hourData}
              />
            </div>
            <div className={isToday ? 'col-sm-6 row-two-graph' : 'd-none'}>
              <LiveEnergyBarGraph minutePvData={minuteData[minuteData.length-1] ?? {}} />
            </div>
            <div className='row'>
              <div className={'col-sm-12 col-md-4'}>
                <DailyEnergyTierDoughnutChart halfHourPvData={halfHourData} energyCalculator={energyCalculator} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SingleDayDashboard;