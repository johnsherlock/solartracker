import { initialState } from '../state-utils';

jest.mock('moment', () => {
  const moment = jest.fn(() => ({
    startOf: jest.fn(() => ({
      format: jest.fn(() => '2023-02-19'),
    })),
  }));
  return moment;
});

describe('initialState', () => {
  it('should return an object with today, selectedDate, formattedSelectedDate, data and totals', () => {
    const state = initialState();
    expect(state).toHaveProperty('today');
    expect(state.today.format('YYYY-MM-DD')).toBe('2023-02-19');
    expect(state).toHaveProperty('selectedDate');
    expect(state.selectedDate.format('YYYY-MM-DD')).toBe('2023-02-19');
    expect(state).toHaveProperty('formattedSelectedDate', '2023-02-19');
    expect(state).toHaveProperty('pvDataCache', new Map());
    expect(state).toHaveProperty('totals', new Map());
    expect(state).toHaveProperty('energyUsageLineGraphScale', 'hour');
  });
});
