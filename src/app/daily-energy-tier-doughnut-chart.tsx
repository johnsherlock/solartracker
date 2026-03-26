import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Filler,
  Decimation,
  ChartOptions,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import { EnergyCalculator } from '../shared/energy-calculator';
import { HalfHourlyPVData } from '../shared/pv-data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  TimeScale,
  Legend,
  Decimation,
  Filler,
);

export interface DailyEnergyTierDoughnutChartProps {
  halfHourPvData: HalfHourlyPVData[];
  energyCalculator: EnergyCalculator;
}

const DailyEnergyTierDoughnutChart = (props: DailyEnergyTierDoughnutChartProps): JSX.Element => {

  const total = props.energyCalculator.calculateTotals(props.halfHourPvData);

  const labels = ['Day', 'Peak', 'Night'];
  const kWhData = [
    total.dayImpTotal,
    total.peakImpTotal,
    total.nightImpTotal,
  ];

  const dow = total.freeImpTotal > 0 ? 'Sat' : 'Mon';

  const costData = [
    props.energyCalculator.calculateDayGrossImportCost(props.halfHourPvData),
    props.energyCalculator.calculatePeakGrossImportCost(props.halfHourPvData),
    props.energyCalculator.calculateNightGrossImportCost(props.halfHourPvData),
  ];
  const backgroundColor = [
    'rgba(255, 206, 86, 0.5)',
    'rgba(255, 99, 132, 0.5)',
    'rgba(54, 162, 235, 0.5)',
  ];
  const borderColor = [
    'rgba(255, 206, 86, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
  ];

  if (total.freeImpTotal > 0) {
    labels.push('Free');
    kWhData.push(total.freeImpTotal);
    costData.push(0);
    backgroundColor.push('rgba(75, 192, 192, 0.5)');
    borderColor.push('rgba(75, 192, 192, 1)');
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Cost',
        data: costData,
        backgroundColor,
        borderColor,
        borderWidth: 1,
      },
      {
        label: 'kWh',
        data: kWhData,
        backgroundColor,
        borderColor,
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions = {
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  return (
    <Doughnut data={chartData} />
  );
};

export default DailyEnergyTierDoughnutChart;