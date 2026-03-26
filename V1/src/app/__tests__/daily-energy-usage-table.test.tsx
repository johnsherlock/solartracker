import { render } from '@testing-library/react';
import React from 'react';
import { EnergyCalculator } from '../../shared/energy-calculator';
import { HalfHourlyPVData } from '../../shared/pv-data';
import DailyEnergyUsageTable from '../daily-energy-usage-table';

jest.mock('../lib/energy-calculator', () => {
  return {
    EnergyCalculator: jest.fn().mockImplementation(() => {
      return {
        recalculateTotals: jest.fn().mockReturnValue(1.00),
        calculateHourlyGrossCostIncStdChgAndDiscount: jest.fn().mockReturnValue(2.00),
        calculateDiscountedHourlyGrossCost: jest.fn().mockReturnValue(3.00),
        calculateExportValue: jest.fn().mockReturnValue(4.00),
        calculateDiscountedGrossCostExcludingStdChg: jest.fn().mockReturnValue(5.00),
        calculateGrossCostPerHalfHourIncStdChgAndDiscount: jest.fn().mockReturnValue(6.00),
        calculateSaving: jest.fn().mockReturnValue(7.00),
        calculateTotalImportedKwH: jest.fn().mockReturnValue(8.00),
        calculateTotalGeneratedKwH: jest.fn().mockReturnValue(9.00),
        calculateTotalConsumedKwH: jest.fn().mockReturnValue(10.00),
        calculateTotalExportedKwH: jest.fn().mockReturnValue(11.00),
        calculaterTotalGreenEnergyCoverage: jest.fn().mockReturnValue(12.00),
        calculateTotalGrossImportCost: jest.fn().mockReturnValue(13.00),
        calculateTotalGrossSavings: jest.fn().mockReturnValue(14.00),
        calculateTotalExportValue: jest.fn().mockReturnValue(15.00),
      };
    }),
  };
});

jest.mock('../lib/num-utils', () => ({
  convertJoulesToKwh: jest.fn(),
  formatToEuro: jest.fn(),
}));

describe('DailyEnergyUsageTable', () => {
  it('renders correctly', () => {
    const data: HalfHourlyPVData[] = [{
      year: 2023,
      month: 2,
      dayOfMonth: 19,
      hour: 1,
      minute: 30,
      importedKwH: 1000,
      generatedKwH: 2000,
      exportedKwH: 500,
      consumedKwH: 1000,
      immersionDivertedKwH: 0,
      immersionBoostedKwH: 0,
      immersionBoostedMins: 0,
      immersionDivertedMins: 0,
      greenEnergyPercentage: 50,
      dayOfWeek: 'Mon',
    }];

    const energyCalculator = new EnergyCalculator({
      dayRate: 0.4673,
      peakRate: 0.5709,
      nightRate: 0.3434,
      exportRate: 0.1850,
      discountPercentage: 0.15,
      annualStandingCharge: 0.7066,
      monthlyPsoCharge: 12.70,
    });

    const component = render(
      <DailyEnergyUsageTable
        data={data}
        energyCalculator={energyCalculator}
      />);
    expect(component).toMatchSnapshot();
  });
});
