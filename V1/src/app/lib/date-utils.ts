import moment from 'moment';
import { CalendarScale, DateRange, FormattedDateRange } from './state-utils';
import { BasePVData } from '../../shared/pv-data';

export const formatDate = (date: moment.Moment): string => moment(date).startOf('day').format('YYYY-MM-DD');

export const dawnOfTime = moment(new Date('2023-01-20')).startOf('day');

export const toMoment = (pvData: BasePVData, locale?: string): moment.Moment => {
  return moment({
    year: pvData.year,
    month: pvData.month - 1,
    date: pvData.dayOfMonth,
    hour: pvData.hour,
    minute: pvData.minute,
  });
};

export const toDayMoment = (day: number = 0, month: number = 0, year: number = 0): moment.Moment => {
  return moment({ year, month: month - 1, day });
};

export const getFormattedTime = (pvData: BasePVData, locale?: string): string => {
  const time = toMoment(pvData, locale);
  return time.format('HH:mm');
};

export const getDateRange = (scale: CalendarScale, date: Date): DateRange => {

  switch (scale) {
    case 'week':
    case 'month':
    case 'year': {
      const m = moment(date);
      const start = moment(m.startOf(scale).toDate());
      const end = moment(m.endOf(scale).toDate());
      return { startDate: start, endDate: end };
    }
    default:
      return { startDate: moment(date), endDate: (moment(date)) };
  }
};

export const formatDateRange = (dateRange: DateRange): FormattedDateRange => {
  return {
    startDate: formatDate(dateRange.startDate),
    endDate: formatDate(dateRange.endDate),
  };
};