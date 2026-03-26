import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Filler,
  Decimation,
  DecimationOptions,
} from 'chart.js';
import moment from 'moment';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import { toDayMoment } from './lib/date-utils';
import { isTouchScreen } from './lib/display-utils';
import { calculateGreenEnergyPercentage } from '../shared/energy-utils';
import { DayTotals } from '../shared/pv-data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Decimation,
  Filler,
);

export type Scale = 'minute' | 'halfHour' | 'hour';

export interface EnergyUsageLineGraphProps {
  data: DayTotals[];
}

const getData = (totals: DayTotals[]): { x: moment.Moment; y: number }[] => {

  return totals.map((item) => ({
    x: toDayMoment(item.dayOfMonth, item.month, item.year),
    y: calculateGreenEnergyPercentage(item.combinedImpTotal, item.conpTotal),
  }));
};

const RangeGreenEnergyPercentageLineGraph = (props: EnergyUsageLineGraphProps): JSX.Element => {

  // create a map of the data based on the view type (hour, halfHour, minute).
  // if the view is minute, then we use the minute data, otherwise we use the halfHour or hour data.

  const data = getData(props.data);

  const lineData = {
    datasets: [
      {
        label: 'Green Energy Percentage',
        data,
        fill: true,
        borderColor: 'rgb(51, 153, 102)',
        backgroundColor: 'rgba(51, 153, 102, 0.5)',
        borderWidth: 1,
        radius: 0,
        hidden: false,
      },
    ],
  };

  const decimation: DecimationOptions = {
    enabled: true,
    algorithm: 'lttb',
  };

  const options = {
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
        title: { display: true, text: 'Green Energy %' },
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
    <Line options={options} data={lineData} />
  );
};

export default RangeGreenEnergyPercentageLineGraph;