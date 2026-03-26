import moment from 'moment';
import * as dateUtils from './date-utils';
import { MinutePVData, RangeTotals } from '../../shared/pv-data';
import { Scale, View } from '../energy-usage-line-graph';

export type CalendarScale = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface FormattedDateRange { startDate: string; endDate: string };
export interface DateRange { startDate: moment.Moment; endDate: moment.Moment };

export interface AppState {
  intervalId?: number;
  today: moment.Moment;
  selectedDate: moment.Moment;
  startDate?: moment.Moment;
  endDate?: moment.Moment;
  formattedSelectedDate: string;
  formattedDateRange?: string;
  pvDataCache: Map<string, MinutePVData[]>;
  totalsCache: Map<string, RangeTotals>;
  energyUsageLineGraphScale: Scale;
  energyUsageLineGraphView: View;
  calendarScale: CalendarScale;
}

export const initialState = (): AppState => {
  const today: moment.Moment = moment().startOf('day');
  const appState: AppState = {
    today: today,
    selectedDate: today,
    formattedSelectedDate: dateUtils.formatDate(today),
    pvDataCache: new Map(),
    totalsCache: new Map(),
    energyUsageLineGraphScale: 'hour',
    energyUsageLineGraphView: 'line',
    calendarScale: 'day',
  };
  return appState;
};