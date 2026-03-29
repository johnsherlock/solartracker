export type MinuteReading = {
  hour: number;
  minute: number;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  selfConsumptionRatio: number;
};

export type PeriodReading = {
  hour: number;
  minute: 0 | 30;
  importKwh: number;
  exportKwh: number;
  generatedKwh: number;
  consumedKwh: number;
  immersionDivertedKwh: number;
  immersionBoostedKwh: number;
  selfConsumptionRatio: number;
};

export type DayDetailResponse = {
  meta: {
    date: string;
    timezone: string;
    source: 'v1-bridge';
    fetchedAt: string;
  };
  minuteData: MinuteReading[];
  halfHourData: PeriodReading[];
  hourData: PeriodReading[];
  summary: {
    totalImportKwh: number;
    totalExportKwh: number;
    totalGeneratedKwh: number;
    totalConsumedKwh: number;
    totalImmersionDivertedKwh: number;
    totalImmersionBoostedKwh: number;
    selfConsumptionRatio: number;
    gridDependenceRatio: number;
  };
  health: {
    recordCount: number;
    isPartialDay: boolean;
    completenessRatio: number;
    hasSuspiciousReadings: boolean;
    fetchedAt: string;
  };
};
