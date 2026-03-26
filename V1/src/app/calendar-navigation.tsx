import moment from 'moment';
import React from 'react';

interface CalendarNavigationProps {
  date: Date;
  decreaseMonth: () => void;
  increaseMonth: () => void;
}

const CalendarNavigation = ({ date, decreaseMonth, increaseMonth }: CalendarNavigationProps) => {

  const previousMonthName = moment(date).subtract(1, 'month').format('MMMM');
  const currentMonthName = moment(date).format('MMMM');
  const nextMonthName = moment(date).add(1, 'month').format('MMMM');
  return (
    <div className='calendar-navigation'>
      <span onClick={decreaseMonth}>&lt;&lt; {previousMonthName} |</span>
      <span className='current-month'>&nbsp;{currentMonthName}&nbsp;</span>
      <span onClick={increaseMonth}>| {nextMonthName} &gt;&gt;</span>
    </div>
  );
};

export default CalendarNavigation;