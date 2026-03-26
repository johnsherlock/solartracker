import moment from 'moment';
import { MinutePVData, RangeTotals } from '../../shared/pv-data';
import { Scale, View } from '../energy-usage-line-graph';
import { getDateRange } from '../lib/date-utils';
import { AppState, CalendarScale, FormattedDateRange } from '../lib/state-utils';


export type Action =
  | { type: 'SET_SCALE'; payload: Scale }
  | { type: 'SET_CALENDAR_SCALE'; payload: CalendarScale }
  | { type: 'SET_VIEW'; payload: View }
  | { type: 'GO_TO_CACHED_DAY'; payload: { selectedDate: moment.Moment; formattedSelectedDate: string } }
  | { type: 'GO_TO_DAY'; payload: { pvData: MinutePVData[]; selectedDate: moment.Moment; formattedSelectedDate: string } }
  | { type: 'SET_CALENDAR_RANGE'; payload: FormattedDateRange }
  | { type: 'GO_TO_RANGE'; payload: { dateRange: FormattedDateRange; rangeTotals: RangeTotals } }
  | { type: 'GO_TO_CACHED_RANGE'; payload: FormattedDateRange }

export const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_SCALE':
      return { ...state, energyUsageLineGraphScale: action.payload };
    case 'SET_CALENDAR_SCALE': {
      const dateRange = getDateRange(action.payload, state.selectedDate.toDate());
      return { ...state, calendarScale: action.payload, ...dateRange };
    }
    case 'SET_VIEW':
      return { ...state, energyUsageLineGraphView: action.payload };
    case 'GO_TO_CACHED_DAY':
      return {
        ...state,
        today: moment().startOf('day'),
        selectedDate: action.payload.selectedDate,
        formattedSelectedDate: action.payload.formattedSelectedDate,
      };
    case 'GO_TO_DAY': {
      const goToDayState = {
        ...state,
        today: moment().startOf('day'),
        selectedDate: action.payload.selectedDate,
        formattedSelectedDate: action.payload.formattedSelectedDate,
        intervalId: undefined,
        startDate: undefined,
        endDate: undefined,
      };
      goToDayState.pvDataCache.set(action.payload.formattedSelectedDate, action.payload.pvData);
      return goToDayState;
    }
    case 'SET_CALENDAR_RANGE': {
      return {
        ...state,
        selectedDate: moment(action.payload.startDate),
        startDate: moment(action.payload.startDate),
        endDate: action.payload.endDate ? moment(action.payload.endDate) : undefined,
      };
    }
    case 'GO_TO_RANGE': {
      const formattedDateRange = `${action.payload.dateRange.startDate}_${action.payload.dateRange.endDate}`;
      const goToRangeState = {
        ...state,
        formattedDateRange,
      };
      goToRangeState.totalsCache.set(formattedDateRange, action.payload.rangeTotals);
      return goToRangeState;
    }
    case 'GO_TO_CACHED_RANGE': {
      const formattedDateRange = `${action.payload.startDate}_${action.payload.endDate}`;
      return {
        ...state,
        formattedDateRange,
      };
    }
    default:
      return state;
  }
};