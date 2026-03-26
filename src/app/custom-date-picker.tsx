import moment from 'moment';
import React, { forwardRef, Dispatch } from 'react';
import DatePicker from 'react-datepicker';
import CalendarNavigation from './calendar-navigation';
import { CalendarScale } from './lib/state-utils';
import OptionLink from './option-link';
import 'react-datepicker/dist/react-datepicker.css';

interface DatePickerDivProps {
  value: string;
  onClick: () => void;
}

const DatePickerDiv = forwardRef<HTMLDivElement, DatePickerDivProps>(({ value, onClick }, ref) => (
  <div className="custom-date-picker" onClick={onClick} ref={ref}>
    {value}
  </div>
));

interface CustomDatePickerProps {
  dispatch: Dispatch<any>;
  scale: CalendarScale;
  selectedDate: moment.Moment;
  startDate?: moment.Moment;
  endDate?: moment.Moment | null;
  onChange: (date: Date | [Date | null, Date | null]) => void;
  onClose: () => void;
}

const CustomDatePicker = ({ selectedDate, dispatch, scale, onChange, onClose, startDate, endDate }: CustomDatePickerProps) => {

  const maxDate = scale === 'day' ? new Date() : moment().subtract(1, 'day').toDate();;

  return (
    <DatePicker
      selected={selectedDate.toDate()}
      startDate={startDate ? startDate.toDate() : selectedDate.toDate()}
      endDate={endDate ? endDate.toDate() : null}
      selectsRange={scale === 'week' || scale === 'custom'}
      showMonthYearPicker={scale === 'month'}
      showYearPicker={scale === 'year'}
      yearItemNumber={4}
      onChange={onChange}
      onCalendarClose={onClose}
      dateFormat="EEE do MMM yyyy"
      minDate={new Date(2023, 0, 20)}
      maxDate={maxDate}
      monthsShown={1}
      customInput={<DatePickerDiv value={selectedDate.toString()} onClick={() => {}}/>}
      todayButton="Back to Today"
      renderCustomHeader={({
        date,
        changeYear,
        changeMonth,
        decreaseMonth,
        increaseMonth,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
      }) => (
        <div
          style={{
            margin: 10,
            display: 'block',
            justifyContent: 'center',
          }}
        >
          <div className="dateRangeType">
            <OptionLink dispatch={dispatch} type="SET_CALENDAR_SCALE" payload="day" selected={scale === 'day'} text="Day" />&nbsp;|&nbsp;
            <OptionLink dispatch={dispatch} type="SET_CALENDAR_SCALE" payload="week" selected={scale === 'week'} text="Week" />&nbsp;|&nbsp;
            <OptionLink dispatch={dispatch} type="SET_CALENDAR_SCALE" payload="month" selected={scale === 'month'} text="Month" />&nbsp;|&nbsp;
            <OptionLink dispatch={dispatch} type="SET_CALENDAR_SCALE" payload="year" selected={scale === 'year'} text="Year" />&nbsp;|&nbsp;
            <OptionLink dispatch={dispatch} type="SET_CALENDAR_SCALE" payload="custom" selected={scale === 'custom'} text="Custom Range" />
          </div>
          <CalendarNavigation date={date} decreaseMonth={decreaseMonth} increaseMonth={increaseMonth}/>
        </div>
      )}
    />
  );
};

export default CustomDatePicker;