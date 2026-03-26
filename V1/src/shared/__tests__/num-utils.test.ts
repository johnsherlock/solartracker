import { formatDecimal, convertJoulesToKwh, formatToEuro } from '../../shared/num-utils';

describe('formatDecimal', () => {
  it('should return the number rounded to two decimal places', () => {
    expect(formatDecimal(1.23456)).toBe(1.23);
    expect(formatDecimal(2.68)).toBe(2.68);
  });
});

describe('convertJoulesToKwh', () => {
  it('should return the equivalent KWh given joules', () => {
    expect(convertJoulesToKwh(3600000)).toBe(1);
    expect(convertJoulesToKwh(7200000)).toBe(2);
  });
});

describe('formatToEuro', () => {
  it('formats a number to euro currency format', () => {
    expect(formatToEuro(10)).toEqual('€10.00');
  });
});