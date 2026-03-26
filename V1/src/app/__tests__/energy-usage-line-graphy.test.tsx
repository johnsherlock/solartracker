import { render } from '@testing-library/react';
import { Line } from 'react-chartjs-2';
import { HalfHourlyPVData, HourlyPVData, MinutePVData } from '../../shared/pv-data';
import HourlyEnergyUsageLineGraph from '../energy-usage-line-graph';

jest.mock('react-chartjs-2', () => ({
  Line: jest.fn(() => null),
}));

describe('DailyEnergyUsageLineGraph', () => {
  it('renders the line graph', () => {
    const minuteData: MinutePVData[] = [
      { hour: 9, minute: 1, importedJoules: 1000000, generatedJoules: 2000000, exportedJoules: 3000000, consumedJoules: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedJoules: 0, immersionDivertedJoules: 230000 },
      { hour: 9, minute: 2, importedJoules: 2000000, generatedJoules: 3000000, exportedJoules: 4000000, consumedJoules: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedJoules: 0, immersionDivertedJoules: 230000 },
      { hour: 9, minute: 3, importedJoules: 3000000, generatedJoules: 4000000, exportedJoules: 5000000, consumedJoules: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedJoules: 0, immersionDivertedJoules: 230000 },
    ];

    const halfHourData: HalfHourlyPVData[] = [
      { hour: 9, minute: 0, importedKwH: 1000000, generatedKwH: 2000000, exportedKwH: 3000000, consumedKwH: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedKwH: 0, immersionDivertedKwH: 230000, immersionDivertedMins: 10, immersionBoostedMins: 20 },
      { hour: 9, minute: 30, importedKwH: 2000000, generatedKwH: 3000000, exportedKwH: 4000000, consumedKwH: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedKwH: 0, immersionDivertedKwH: 230000, immersionDivertedMins: 10, immersionBoostedMins: 20 },
    ];

    const hourData: HourlyPVData[] = [
      { hour: 9, minute: 0, importedKwH: 1000000, generatedKwH: 2000000, exportedKwH: 3000000, consumedKwH: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedKwH: 0, immersionDivertedKwH: 230000, immersionDivertedMins: 10, immersionBoostedMins: 20 },
      { hour: 10, minute: 0, importedKwH: 2000000, generatedKwH: 3000000, exportedKwH: 4000000, consumedKwH: 4000000, dayOfMonth: 5, dayOfWeek: 'Mon', year: 2023, month: 3, greenEnergyPercentage: 23, immersionBoostedKwH: 0, immersionDivertedKwH: 230000, immersionDivertedMins: 10, immersionBoostedMins: 20 },
    ];

    render(<HourlyEnergyUsageLineGraph
      scale='halfHour'
      view='cumulative'
      minutePvData={minuteData}
      halfHourPvData={halfHourData}
      hourlyPvData={hourData}
    />);

    expect(Line).toHaveBeenCalledTimes(1);
  });
});
