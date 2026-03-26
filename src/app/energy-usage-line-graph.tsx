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
import { isTouchScreen } from './lib/display-utils';
import { convertJoulesToKw } from '../shared/num-utils';
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

const toMoment = (hr: number = 0, min: number = 0): moment.Moment => {
  return moment().hour(hr).minute(min);
};

export type Scale = 'minute' | 'halfHour' | 'hour';
export type View = 'line' | 'cumulative';
type DataPoint = 'imported' | 'generated' | 'consumed' | 'immersionDiverted' | 'exported';

export interface EnergyUsageLineGraphProps {
  minutePvData: MinutePVData[];
  halfHourPvData: HalfHourlyPVData[];
  hourlyPvData: HourlyPVData[];
  scale: Scale;
  view: View;
}

const getDataForView = (props: EnergyUsageLineGraphProps, dataPoint: DataPoint): { x: moment.Moment; y: number }[] => {

  let data: { x: moment.Moment; y: number }[];

  if (props.scale === 'minute') {
    data = props.minutePvData.map((item) => ({ x: toMoment(item.hour, item.minute), y: convertJoulesToKw(item[`${dataPoint}Joules`]) }));
  } else if (props.scale === 'halfHour') {
    data = props.halfHourPvData.map((item) => ({ x: toMoment(item.hour, item.minute), y: item[`${dataPoint}KwH`] }));
  } else {
    data = props.hourlyPvData.map((item) => ({ x: toMoment(item.hour, item.minute), y: item[`${dataPoint}KwH`] }));
  }

  return props.view === 'line'? data : convertToCumulativeView(data);
};

const convertToCumulativeView = (data: { x: moment.Moment; y: number }[]): { x: moment.Moment; y: number }[] => {
  let cumulativeY = 0;
  return data.map(item => {
    cumulativeY += item.y;
    return { x: item.x, y: cumulativeY };
  });
};

const EnergyUsageLineGraph = (props: EnergyUsageLineGraphProps): JSX.Element => {

  const fill = props.scale === 'minute' && props.view !== 'cumulative';
  const borderWidth = props.scale === 'minute' && props.view !== 'cumulative' ? 1 : 1;
  const unit = props.scale === 'minute' ? 'kw' : 'kWh';

  // create a map of the data based on the view type (hour, halfHour, minute).
  // if the view is minute, then we use the minute data, otherwise we use the halfHour or hour data.

  const lineData = {
    datasets: [
      {
        label: `Imp ${unit}`,
        data: getDataForView(props, 'imported'),
        fill,
        borderColor: 'rgb(255, 99, 888)',
        backgroundColor: 'rgba(255, 99, 255, 0.5)',
        borderWidth,
        radius: 0,
        hidden: props.scale === 'minute' && props.view !== 'cumulative',
      },
      {
        label: `Gen ${unit}`,
        data: getDataForView(props, 'generated'),
        fill,
        borderColor: 'rgb(51, 153, 102)',
        backgroundColor: 'rgba(51, 153, 102, 0.5)',
        borderWidth,
        radius: 0,
        hidden: false,
      },
      {
        label: `Exp ${unit}`,
        data: getDataForView(props, 'exported'),
        fill,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderWidth,
        radius: 0,
        hidden: props.scale === 'minute' && props.view !== 'cumulative',
      },
      {
        label: `Consumed ${unit}`,
        data: getDataForView(props, 'consumed'),
        fill,
        borderColor: 'rgb(255, 153, 102)',
        backgroundColor: 'rgba(255, 153, 102, 0.5)',
        borderWidth,
        radius: 0,
        hidden: false,
      },
      {
        label: `Immersion ${unit}`,
        data: getDataForView(props, 'immersionDiverted'),
        fill,
        borderColor: 'rgb(179, 0, 0)',
        backgroundColor: 'rgba(179, 0, 0, 0.5)',
        borderWidth,
        radius: 0,
        hidden: props.scale === 'minute' && props.view !== 'cumulative',
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
        title: { display: !isTouchScreen(), text: props.scale === 'minute' ? 'kw' : 'kWh' },
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

export default EnergyUsageLineGraph;