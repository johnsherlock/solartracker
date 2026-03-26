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
import { toMoment } from './lib/date-utils';
import { isTouchScreen } from './lib/display-utils';
import { HalfHourlyPVData, HourlyPVData, MinutePVData } from '../shared/pv-data';

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
  scale: Scale;
  minutePvData: MinutePVData[];
  halfHourPvData: HalfHourlyPVData[];
  hourlyPvData: HourlyPVData[];
}

const getDataForScale = (
  minuteData: MinutePVData[], halfHourData: HalfHourlyPVData[], hourlyData: HourlyPVData[], scale: Scale): { x: moment.Moment; y: number }[] => {

  let filteredData;
  // filter out items from halfHourlyData where greenEnergyPercentage is 0
  switch (scale) {
    case 'minute':
      filteredData = minuteData.filter((item) => item.greenEnergyPercentage !== 0);
      break;
    case 'halfHour':
      filteredData = halfHourData.filter((item) => item.greenEnergyPercentage !== 0);
      break;
    case 'hour':
      filteredData = hourlyData.filter((item) => item.greenEnergyPercentage !== 0);
      break;
  }
  // map the remaining items to an array of objects with x and y properties
  return filteredData.map((item) => ({ x: toMoment(item), y: item.greenEnergyPercentage }));
};

const GreenEnergyPercentageLineGraph = (props: EnergyUsageLineGraphProps): JSX.Element => {

  // create a map of the data based on the view type (hour, halfHour, minute).
  // if the view is minute, then we use the minute data, otherwise we use the halfHour or hour data.

  const data = getDataForScale(props.minutePvData, props.halfHourPvData, props.hourlyPvData, props.scale);

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
          unit: 'hour' as const,
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

export default GreenEnergyPercentageLineGraph;