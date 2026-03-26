import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { getFormattedTime } from './lib/date-utils';
import { isTouchScreen } from './lib/display-utils';
import { calculateGreenEnergyPercentage } from '../shared/energy-utils';
import { convertJoulesToKw } from '../shared/num-utils';
import { MinutePVData } from '../shared/pv-data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

export interface EnergyUsageLineGraphProps {
  minutePvData: MinutePVData;
}

const LiveEnergyBarGraph = (props: EnergyUsageLineGraphProps): JSX.Element => {

  const data = [
    convertJoulesToKw(props.minutePvData.importedJoules),
    convertJoulesToKw(props.minutePvData.generatedJoules),
    convertJoulesToKw(props.minutePvData.consumedJoules),
    convertJoulesToKw(props.minutePvData.immersionDivertedJoules),
    convertJoulesToKw(props.minutePvData.exportedJoules),
  ];

  const solarCoverage = calculateGreenEnergyPercentage(props.minutePvData.importedJoules, props.minutePvData.consumedJoules);

  const labels = ['Imp', 'Gen', 'Cons', 'Immersion', 'Exp'];
  const barData = {
    labels: labels,
    datasets: [{
      label: 'kW',
      data,
      backgroundColor: [
        'rgba(255, 99, 255, 0.5)', // imported
        'rgba(51, 153, 102, 0.5)', // generated
        'rgba(255, 153, 102, 0.5)', // consumed
        'rgba(179, 0, 0, 0.5)', // immersion diverted
        'rgba(53, 162, 235, 0.5)', // exported
      ],
      borderColor: [
        'rgba(255, 99, 255)',
        'rgba(51, 153, 102)',
        'rgba(255, 153, 102)',
        'rgba(179, 0, 0)',
        'rgba(53, 162, 235)',
      ],
      borderWidth: 1,
    }],
  };

  const chartTitle = `Live Energy Usage: ${getFormattedTime(props.minutePvData)} - ${solarCoverage}% Solar Coverage`;

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: chartTitle,
      },
      tooltip: {
        enabled: !isTouchScreen(),
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'kw' },
      },
    },
  };

  return (
    <Bar options={options} data={barData} />
  );
};
export default LiveEnergyBarGraph;
