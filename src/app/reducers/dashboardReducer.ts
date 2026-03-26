import { Scale, View } from '../energy-usage-line-graph';
import { CalendarScale } from '../lib/state-utils';


export type DashboardAction =
  | { type: 'SET_SCALE'; payload: Scale }
  | { type: 'SET_CALENDAR_SCALE'; payload: CalendarScale }
  | { type: 'SET_VIEW'; payload: View }
  | { type: 'SET_DARK_MODE'; payload: boolean };

export interface DashboardState {
  energyUsageLineGraphScale: Scale;
  calendarScale: CalendarScale;
  energyUsageLineGraphView: View;
  darkMode: boolean;
}

export const initialState: DashboardState = {
  energyUsageLineGraphScale: 'hour',
  calendarScale: 'day',
  energyUsageLineGraphView: 'line',
  darkMode: false,
};

export const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
  switch (action.type) {
    case 'SET_SCALE':
      return { ...state, energyUsageLineGraphScale: action.payload };
    case 'SET_CALENDAR_SCALE':
      return { ...state, calendarScale: action.payload };
    case 'SET_VIEW':
      return { ...state, energyUsageLineGraphView: action.payload };
    case 'SET_DARK_MODE':
      return { ...state, darkMode: action.payload };
    default:
      return state;
  }
};