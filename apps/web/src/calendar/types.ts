export type CalendarMetric =
  | 'generation_kwh'
  | 'consumed_kwh'
  | 'self_consumed_kwh'
  | 'self_consumed_value'
  | 'total_solar_value'
  | 'solar_coverage'
  | 'import_kwh'
  | 'import_cost'
  | 'export_kwh'
  | 'export_credit'
  | 'immersion_kwh'
  | 'net_energy_bill'
  | 'net_solar_position'
  | 'prorata_coverage';

export function isCalendarMetric(value: string): value is CalendarMetric {
  return [
    'generation_kwh',
    'consumed_kwh',
    'self_consumed_kwh',
    'self_consumed_value',
    'total_solar_value',
    'solar_coverage',
    'import_kwh',
    'import_cost',
    'export_kwh',
    'immersion_kwh',
    'net_energy_bill',
    'net_solar_position',
    'prorata_coverage',
  ].includes(value);
}
