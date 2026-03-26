import { render } from '@testing-library/react';
import moment from 'moment';
import React from 'react';
import CustomDatePicker from '../custom-date-picker';

describe('CustomDatePicker', () => {
  test('renders correctly', () => {
    const selectedDate = moment('2023-02-19');
    const onChange = jest.fn();
    const { container } = render(<CustomDatePicker selectedDate={selectedDate} onChange={onChange} dispatch={() => {}} scale={'day'} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});