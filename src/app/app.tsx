import moment from 'moment';
import React, { useReducer, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import { useSwipeable } from 'react-swipeable';
import Visibility from 'visibilityjs';
import CustomDatePicker from './custom-date-picker';
import * as dateUtils from './lib/date-utils';
import { formatDate, formatDateRange, getDateRange } from './lib/date-utils';
import * as pvService from './lib/pv-service';
import * as stateUtils from './lib/state-utils';
import { FormattedDateRange } from './lib/state-utils';
import MultiDayDashboard from './multi-day-dashboard';
import { appReducer } from './reducers/app-reducer';
import SingleDayDashboard from './single-day-dashboard';
import { EnergyCalculator } from '../shared/energy-calculator';
import { convertMinuteDataToHalfHourlyData, convertMinuteDataToHourlyData } from '../shared/energy-utils';
import { MinutePVData, RangeTotals } from '../shared/pv-data';

function App() {
  // const [state, setState] = useState(stateUtils.initialState());
  const [state, dispatch] = useReducer(appReducer, stateUtils.initialState());

  const intervalRef = useRef(-1);

  // TODO: Initialise this dynamically (from props or per user)
  const energyCalculator = new EnergyCalculator({
    dayRate: 0.4673,
    peakRate: 0.5709,
    nightRate: 0.3434,
    exportRate: 0.1850,
    discountPercentage: 0.15,
    annualStandingCharge: 257.91,
    monthlyPsoCharge: 12.75,
  });

  const startAutoRefresh = (selectedDate: moment.Moment) => {
    console.log('Page visible - refreshing data every minute. Interval ID: ', intervalRef.current);
    intervalRef.current = Visibility.every(1 * 60 * 1000, async () => {
      await goToDay(selectedDate);
    });
    console.log(`Interval ID: ${intervalRef.current}`);
  };

  const stopAutoRefresh = () => {
    console.log('Stop auto refresh');
    if (intervalRef.current > -1) {
      console.log(`Stopping interval ${intervalRef.current}`);
      Visibility.stop(intervalRef.current);
      intervalRef.current = -1;
    }
  };

  const goToDay = async (targetDate: moment.Moment) => {
    console.log(`Getting data for ${targetDate}`, new Date());
    document.body.style.cursor = 'progress';
    const formattedTargetDate = dateUtils.formatDate(targetDate);
    if (state.pvDataCache.get(formattedTargetDate) && targetDate.isBefore(state.today)) {
      stopAutoRefresh();
      dispatch({ type: 'GO_TO_CACHED_DAY', payload: { selectedDate: targetDate, formattedSelectedDate: formattedTargetDate } });
      document.body.style.cursor = 'auto';
    } else {
      console.log('Fetching data from server');
      const pvData: MinutePVData[] = await pvService.getPVDataForDate(formattedTargetDate);
      console.log('State: ', state);
      dispatch({ type: 'GO_TO_DAY', payload: { pvData, selectedDate: targetDate, formattedSelectedDate: formattedTargetDate } });
      console.log('IntervalRef: ', intervalRef.current);
      if (intervalRef.current == -1) {
        startAutoRefresh(state.today);
      }
      document.body.style.cursor = 'auto';
    }
    await preFetchData(targetDate);
  };

  const preFetchData = async (targetDate: moment.Moment) => {
    console.log(`Pre-fetching data for days either side of ${targetDate}`);
    const nextDay = moment(targetDate).add(1, 'day');
    const formattedNextDay = dateUtils.formatDate(nextDay);
    const previousDay = moment(targetDate).subtract(1, 'day');
    const formattedPreviousDay = dateUtils.formatDate(previousDay);
    let nextDayData: MinutePVData[] = [];
    let previousDayData: MinutePVData[] = [];

    if (nextDay.isBefore(state.today) && !state.pvDataCache.get(formattedNextDay)) {
      nextDayData = await pvService.getPVDataForDate(formattedNextDay);
    }
    if (!state.pvDataCache.get(formattedPreviousDay)) {
      previousDayData = await pvService.getPVDataForDate(formattedPreviousDay);
    }
    if (nextDayData.length > 0) {
      console.log('Adding next day data to state');
      state.pvDataCache.set(formattedNextDay, nextDayData);
    }
    if (previousDayData.length > 0) {
      console.log('Adding previous day data to state');
      state.pvDataCache.set(formattedPreviousDay, previousDayData);
    }
  };

  const getDataForRange = async (dateRange: FormattedDateRange): Promise<RangeTotals> => {
    console.log(`Fetch data for range ${dateRange.startDate} - ${dateRange.endDate}`);
    const totals = await pvService.getPVTotalsForRange(dateRange.startDate, dateRange.endDate);
    console.log('Received: ', totals);
    return totals;
  };

  const handleDate = async (date: Date | [Date | null, Date | null]) => {
    console.log('Handle date. State: ', state);
    if (state.calendarScale === 'day' && date instanceof Date) {
      await goToDay(moment(date));
    } else {
      stopAutoRefresh();
      let dateRange, formattedDateRange;
      if ((state.calendarScale === 'month' || state.calendarScale === 'year') && date instanceof Date) {
        dateRange = getDateRange(state.calendarScale, date);
        formattedDateRange = formatDateRange(dateRange);
      } else if (date instanceof Array) {
        const [start, end] = date;
        if (state.calendarScale === 'week') {
          dateRange = getDateRange(state.calendarScale, start!);
          formattedDateRange = formatDateRange(dateRange);
        } else {
          formattedDateRange = { startDate: start ? formatDate(moment(start)) : '', endDate: end ? formatDate(moment(end)) : '' };
        }
      } else {
        console.log('Unspported date combo!');
        throw new Error('Somehow in unspported date combination');
      }
      dispatch({ type: 'SET_CALENDAR_RANGE', payload: formattedDateRange });
      const compoundKey = `${formattedDateRange.startDate}_${formattedDateRange.endDate}`;
      if (state.totalsCache.get(compoundKey)) {
        dispatch({ type: 'GO_TO_CACHED_RANGE', payload: formattedDateRange });
      } else {
        const rangeTotals = await getDataForRange(formattedDateRange);
        if (rangeTotals.aggregatedData) {
          dispatch({ type: 'GO_TO_RANGE', payload: { dateRange: formattedDateRange, rangeTotals: rangeTotals } });
        }
      }
    }
  };

  const handleCalendarClose = async () => {
    if (state.startDate && state.endDate) {
      await handleDate([state.startDate.toDate(), state.endDate.toDate()]);
    } else {
      await handleDate(state.selectedDate.toDate());
    }
  };

  useEffect(() => {
    // retrieve data for today.
    goToDay(state.selectedDate).catch((error) => {
      console.error(`Error retrieving data for ${state.selectedDate}`, error);
    });
    return () => {
      console.log(`Stopping refresh with id: ${intervalRef.current}`);
      Visibility.stop(intervalRef.current);
    };
  }, []);

  const canGoToPreviousDay = () => {
    return state.selectedDate.isAfter(dateUtils.dawnOfTime);
  };

  const canGoToNextDay = () => {
    return state.selectedDate.isBefore(state.today);
  };

  const goToPreviousDay = async (): Promise<any> => {
    await goToDay(moment(state.selectedDate.subtract(1, 'day')));
  };

  const goToNextDay = async () => {
    await goToDay(moment(state.selectedDate.add(1, 'day')));
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    // Query new data based on swipe direction
    if (direction === 'right' && canGoToPreviousDay()) {
      await goToPreviousDay();
    } else if (direction === 'left' && canGoToNextDay()) {
      await goToNextDay();
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
  });

  return (
    <>
      <div {...handlers}>
        <div className="navigation">
          <div className="text-center">
            <div className="date">
              <CustomDatePicker
                dispatch={dispatch}
                scale={state.calendarScale}
                selectedDate={state.selectedDate}
                startDate={state.startDate}
                endDate={state.endDate}
                onChange={handleDate}
                onClose={handleCalendarClose}
              />
            </div>
          </div>
        </div>
        { state.calendarScale === 'day' ? (
          <SingleDayDashboard
            selectedDate={state.selectedDate}
            startDate={state.startDate}
            endDate={state.endDate}
            today={state.today}
            minuteData={state.pvDataCache.get(state.formattedSelectedDate) ?? []}
            halfHourData={convertMinuteDataToHalfHourlyData(state.pvDataCache.get(state.formattedSelectedDate))}
            hourData={convertMinuteDataToHourlyData(state.pvDataCache.get(state.formattedSelectedDate))}
            energyCalculator={energyCalculator}
            goToPreviousDay={goToPreviousDay}
            goToNextDay={goToNextDay}
            goToDay={handleDate}
            dispatch={dispatch}
            energyUsageLineGraphScale={state.energyUsageLineGraphScale}
            energyUsageLineGraphView={state.energyUsageLineGraphView}
            calendarScale={state.calendarScale}
          />
        ) :
          <MultiDayDashboard
            startDate={state.startDate}
            endDate={state.endDate}
            energyCalculator={energyCalculator}
            dispatch={dispatch}
            calendarScale={state.calendarScale}
            totals={state.totalsCache.get(`${state.formattedDateRange}`)}
          />
        }
      </div>
    </>
  );
}

export default App;
