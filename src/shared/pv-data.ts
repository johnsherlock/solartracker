export interface BasePVData {
  year: number;
  month: number;
  dayOfMonth: number;
  dayOfWeek: 'Sun' | 'Mon' | 'Tues' | 'Wed' | 'Thurs' | 'Fri' | 'Sat';
  hour: number;
  minute: number;
  greenEnergyPercentage: number;
}

export interface MinutePVData extends BasePVData {
  importedJoules: number;
  generatedJoules: number;
  exportedJoules: number;
  immersionDivertedJoules: number;
  immersionBoostedJoules: number;
  consumedJoules: number;
}

export interface HalfHourlyPVData extends BasePVData {
  minute: 0 | 30;
  importedKwH: number;
  generatedKwH: number;
  exportedKwH: number;
  immersionDivertedKwH: number;
  immersionBoostedKwH: number;
  immersionDivertedMins: number;
  immersionBoostedMins: number;
  consumedKwH: number;
}

export interface HourlyPVData extends HalfHourlyPVData {
  minute: 0;
};

export interface Totals {
  genTotal: number;
  expTotal: number;
  conpTotal: number;
  dayImpTotal: number;
  peakImpTotal: number;
  nightImpTotal: number;
  combinedImpTotal: number;
  freeImpTotal: number;
  immersionTotal: number;
  immersionRunTime: number;
  grossSavingTotal: number;
}

export interface DayTotals extends Totals {
  year: number;
  month: number;
  dayOfMonth: number;
}

export interface RangeTotals {
  rawData: DayTotals[];
  aggregatedData?: Totals;
}