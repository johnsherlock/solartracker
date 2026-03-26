import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Filler,
  Decimation,
  DecimationOptions,
} from 'chart.js';
import moment from 'moment';
import React from 'react';
import { Bar } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import { toDayMoment } from './lib/date-utils';
import { isTouchScreen } from './lib/display-utils';
import { CalendarScale } from './lib/state-utils';
import { DayTotals } from '../shared/pv-data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Decimation,
  Filler,
);

type DataPoint = 'genTotal' | 'expTotal' | 'conpTotal' | 'peakImpTotal' | 'nightImpTotal' | 'dayImpTotal' | 'combinedImpTotal' | 'freeImpTotal';

export interface RangeEnergyUsageBarGraphProps {
  data: DayTotals[];
}

const getData = (props: RangeEnergyUsageBarGraphProps, dataPoint: DataPoint): { x: moment.Moment; y: number }[] => {

  let data: { x: moment.Moment; y: number }[];

  data = props.data.map((item) => ({ x: toDayMoment(item.dayOfMonth, item.month, item.year), y: item[dataPoint] }));

  // Sort the array by the 'x' property (date) in ascending order
  data.sort((a, b) => a.x.valueOf() - b.x.valueOf());

  return data;
};

const convertToCumulativeView = (data: { x: moment.Moment; y: number }[]): { x: moment.Moment; y: number }[] => {
  let cumulativeY = 0;
  return data.map(item => {
    cumulativeY += item.y;
    return { x: item.x, y: cumulativeY };
  });
};

const RangeEnergyUsageBarGraph = (props: RangeEnergyUsageBarGraphProps): JSX.Element => {

  const fill = false;
  const borderWidth = 1;
  const unit = 'kWh';

  // create a map of the data based on the view type (hour, halfHour, minute).
  // if the view is minute, then we use the minute data, otherwise we use the halfHour or hour data.

  const lineData = {
    datasets: [
      {
        label: `Imp ${unit}`,
        data: getData(props, 'combinedImpTotal'),
        fill,
        borderColor: 'rgb(255, 99, 888)',
        backgroundColor: 'rgba(255, 99, 255, 0.5)',
        borderWidth,
        radius: 0,
        hidden: false,
      },
      {
        label: `Gen ${unit}`,
        data: getData(props, 'genTotal'),
        fill,
        borderColor: 'rgb(51, 153, 102)',
        backgroundColor: 'rgba(51, 153, 102, 0.5)',
        borderWidth,
        radius: 0,
        hidden: false,
      },
      {
        label: `Exp ${unit}`,
        data: getData(props, 'expTotal'),
        fill,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderWidth,
        radius: 0,
        hidden: true,
      },
      {
        label: `Consumed ${unit}`,
        data: getData(props, 'conpTotal'),
        fill,
        borderColor: 'rgb(255, 153, 102)',
        backgroundColor: 'rgba(255, 153, 102, 0.5)',
        borderWidth,
        radius: 0,
        hidden: true,
      },
      {
        label: `Free ${unit}`,
        data: getData(props, 'freeImpTotal'),
        fill,
        borderColor: 'rgb(179, 0, 0)',
        backgroundColor: 'rgba(179, 0, 0, 0.5)',
        borderWidth,
        radius: 0,
        hidden: true,
      },
    ],
  };

  const decimation: DecimationOptions = {
    enabled: true,
    algorithm: 'lttb',
  };

  const options = {
    maintainAspectRatio: false as const,
    responsive: true as const,
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    plugins: {
      decimation: decimation,
      legend: {
      },
      tooltip: {
        enabled: !isTouchScreen(),
      },
    },
    scales: {
      y: {
        title: { display: !isTouchScreen(), text: 'kWh' },
      },
      x: {
        type: 'time' as const,
        time: {
          unit: 'day' as const,
        },
      },
    },
    elements: {
      point: {
        pointStyle: isTouchScreen() ? 'dash' : 'circle',
      },
    },
  };

  return (
    <Bar options={options} data={lineData} />
  );
};

export default RangeEnergyUsageBarGraph;