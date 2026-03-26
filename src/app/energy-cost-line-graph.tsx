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
import { EnergyCalculator } from '../shared/energy-calculator';
import { HalfHourlyPVData, HourlyPVData } from '../shared/pv-data';

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

export type View = 'line' | 'cumulative';

export interface EnergyUsageLineGraphProps {
  halfHourPvData: HalfHourlyPVData[];
  hourlyPvData: HourlyPVData[];
  view: View;
  energyCalculator: EnergyCalculator;
}

const getImportCost = (props: EnergyUsageLineGraphProps): { x: moment.Moment; y: number }[] => {
  const data = props.halfHourPvData.map((item) => ({
    x: toMoment(item.hour, item.minute),
    y: props.energyCalculator.calculateGrossCostPerHalfHourIncStdChgAndDiscount(item.hour, item.dayOfWeek, item.importedKwH),
  }));

  return props.view === 'line'? data : convertToCumulativeView(data);
};

const getGeneratedValue = (props: EnergyUsageLineGraphProps): { x: moment.Moment; y: number }[] => {
  const data = props.halfHourPvData.map((item) => ({
    x: toMoment(item.hour, item.minute),
    y: props.energyCalculator.calculateSaving(item.hour, item.dayOfWeek, item.importedKwH, item.consumedKwH),
  }));

  return props.view === 'line'? data : convertToCumulativeView(data);
};

const getExportValue = (props: EnergyUsageLineGraphProps): { x: moment.Moment; y: number }[] => {
  const data = props.halfHourPvData.map((item) => ({
    x: toMoment(item.hour, item.minute),
    y: props.energyCalculator.calculateExportValue(item.exportedKwH),
  }));

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

  const fill = false;
  const borderWidth = 1;
  const unit = 'EUR';

  const lineData = {
    datasets: [
      {
        label: 'Import €',
        data: getImportCost(props),
        fill,
        borderColor: 'rgb(255, 99, 888)',
        backgroundColor: 'rgba(255, 99, 255, 0.5)',
        borderWidth,
        radius: 0,
      },
      {
        label: 'Savings €',
        data: getGeneratedValue(props),
        fill,
        borderColor: 'rgb(51, 153, 102)',
        backgroundColor: 'rgba(51, 153, 102, 0.5)',
        borderWidth,
        radius: 0,
        hidden: false,
      },
      {
        label: 'Export €',
        data: getExportValue(props),
        fill,
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        borderWidth,
        radius: 0,
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
        title: { display: !isTouchScreen(), text: 'EUR' },
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