import { render, act, waitFor } from '@testing-library/react';
import moment from 'moment';
import React from 'react';
import App from '../app';
import * as pvService from '../lib/pv-service';

jest.mock('../lib/pv-service', () => ({
  getPVDataForDate: jest.fn().mockResolvedValue([
    { yr: 2023, mon: 1, dom: 31, hr: 11, imp: 1895904, gen: 7190, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 1, imp: 2525323, gen: 5515, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 2, imp: 2374196, gen: 5450, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 3, imp: 713464, gen: 7194, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 4, imp: 624580, gen: 7128, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 5, imp: 814572, gen: 7132, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 6, imp: 961806, gen: 7130, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 7, imp: 1425098, gen: 6830, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 8, imp: 777800, gep: 163361, gen: 418, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 9, imp: 352502, exp: 9228, gep: 2975205, h1d: 1369453, dow: 'Tue' },
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 10, imp: 2456, exp: 3243905, gep: 5228174, h1d: 755088, dow: 'Tue' },
  ]),
  convertMinuteDataToHalfHourlyData: jest.fn().mockReturnValue([
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 0, imp: 1895904, gen: 7190, dow: 'Tue' },
  ]),
  convertMinuteDataToHourlyData: jest.fn().mockReturnValue([
    { yr: 2023, mon: 1, dom: 31, hr: 11, min: 0, imp: 1895904, gen: 7190, dow: 'Tue' },
  ]),
}));


const mockMoment = moment('2023-02-13').startOf('day');
const mockFormattedDate = '2023-02-13';

jest.mock('../lib/date-utils', () => ({
  ...jest.requireActual('../lib/date-utils'),
  formatDate: jest.fn().mockReturnValue('2023-02-13'),
}));

jest.mock('../lib/energy-calculator', () => {
  return {
    EnergyCalculator: jest.fn().mockImplementation(() => {
      return {
        recalculateTotals: jest.fn(),
      };
    }),
  };
});

jest.mock('../lib/state-utils', () => ({
  initialState: jest.fn().mockImplementation(() => {
    return {
      today: mockMoment,
      selectedDate: mockMoment,
      formattedSelectedDate: mockFormattedDate,
      pvDataCache: new Map(),
      totals: new Map(),
      energyUsageLineGraphScale: 'hour',
    };
  }),
}));

jest.mock('../dashboard', () => () => <div data-testid="Dashboard-mock" />);

describe('App', () => {

  it('renders correctly', async () => {
    const selectedDate = moment('2023-02-13');
    const formattedSelectedDate = selectedDate.format('YYYY-MM-DD');

    let renderResult: any;
    await act(async () => {
      renderResult = render(<App />);
    });

    await waitFor(() => {
      expect(pvService.getPVDataForDate).toHaveBeenCalledWith(formattedSelectedDate);
    });

    expect(renderResult!.asFragment()).toMatchSnapshot();
  });
});
