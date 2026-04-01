import type { FinancialEstimate } from './loader';

type ScreenState = 'healthy' | 'stale' | 'warning' | 'disconnected';

export type HistoricalDayTotals = {
  generatedKwh: number;
  consumedKwh: number;
  importKwh: number;
  exportKwh: number;
  immersionDivertedKwh: number;
};

export type HistoricalHealth = {
  expectedMinutes: number;
  coveredMinutes: number;
  uptimePercent: number;
  incidents: { id: string }[];
};

export type HistoricalNote = {
  title: string;
  body: string;
  tone: 'neutral' | 'good' | 'caution';
};

export type HistoricalNotesModel = {
  heading: string;
  summary: string;
  notes: HistoricalNote[];
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function buildHistoricalNotesModel({
  screenState,
  dayTotals,
  health,
  hasTariff,
  financialEstimate,
}: {
  screenState: ScreenState;
  dayTotals: HistoricalDayTotals | null;
  health: HistoricalHealth;
  hasTariff: boolean;
  financialEstimate: FinancialEstimate | null;
}): HistoricalNotesModel {
  if (screenState === 'disconnected' || !dayTotals) {
    return {
      heading: 'Day story',
      summary: 'The selected day could not be reconstructed from provider data.',
      notes: [
        {
          title: 'Coverage',
          body: 'No usable provider data was returned for this date, so the day should be treated as unavailable rather than low-generation.',
          tone: 'caution',
        },
        {
          title: 'Financial interpretation',
          body: 'Value commentary is held back until the day has enough data to support it.',
          tone: 'neutral',
        },
      ],
    };
  }

  const selfConsumptionKwh = Math.max(0, dayTotals.generatedKwh - dayTotals.exportKwh);
  const selfConsumptionRatio =
    dayTotals.generatedKwh > 0 ? clampPercent((selfConsumptionKwh / dayTotals.generatedKwh) * 100) : 0;
  const exportRatio =
    dayTotals.generatedKwh > 0 ? clampPercent((dayTotals.exportKwh / dayTotals.generatedKwh) * 100) : 0;
  const gridRelianceRatio =
    dayTotals.consumedKwh > 0 ? clampPercent((dayTotals.importKwh / dayTotals.consumedKwh) * 100) : 0;
  const solarCoverageRatio =
    dayTotals.consumedKwh > 0
      ? clampPercent(((dayTotals.consumedKwh - dayTotals.importKwh) / dayTotals.consumedKwh) * 100)
      : 0;
  const completenessRatio =
    health.expectedMinutes > 0 ? clampPercent((health.coveredMinutes / health.expectedMinutes) * 100) : 0;
  const isPartialDay = completenessRatio < 99.9;
  const hasTrustWarning = screenState === 'warning' || health.incidents.length > 0;

  const generationNote: HistoricalNote =
    dayTotals.generatedKwh <= 0
      ? {
          title: 'Generation strength',
          body: 'No solar generation was recorded for the selected day, so household demand was carried by the grid throughout.',
          tone: 'caution',
        }
      : solarCoverageRatio >= 75
        ? {
            title: 'Generation strength',
            body: `Solar covered about ${formatPercent(solarCoverageRatio)} of home demand across the day, which makes this read as a solar-led day rather than a grid-led one.`,
            tone: 'good',
          }
        : solarCoverageRatio >= 40
          ? {
              title: 'Generation strength',
              body: `Solar covered about ${formatPercent(solarCoverageRatio)} of home demand, so the day looks balanced between onsite production and grid support.`,
              tone: 'neutral',
            }
          : {
              title: 'Generation strength',
              body: `Solar covered about ${formatPercent(solarCoverageRatio)} of home demand, so the selected day leaned more heavily on imported electricity.`,
              tone: 'neutral',
            };

  const gridNote: HistoricalNote =
    dayTotals.consumedKwh <= 0
      ? {
          title: 'Grid reliance',
          body: 'Household demand was negligible in the available data, so grid-reliance language is intentionally held back.',
          tone: 'neutral',
        }
      : gridRelianceRatio <= 25
        ? {
            title: 'Grid reliance',
            body: `Only about ${formatPercent(gridRelianceRatio)} of demand came from the grid, which suggests the home was mostly running on onsite solar for this date.`,
            tone: 'good',
          }
        : gridRelianceRatio <= 60
          ? {
              title: 'Grid reliance',
              body: `Around ${formatPercent(gridRelianceRatio)} of demand still came from the grid, so solar helped materially without fully carrying the day.`,
              tone: 'neutral',
            }
          : {
              title: 'Grid reliance',
              body: `Around ${formatPercent(gridRelianceRatio)} of demand came from imported electricity, so the day stayed clearly grid-reliant despite some solar contribution.`,
              tone: 'caution',
            };

  const mixNote: HistoricalNote =
    dayTotals.generatedKwh <= 0
      ? {
          title: 'Export and self-consumption',
          body: 'There was no recorded generation to split between export and self-consumption on this date.',
          tone: 'neutral',
        }
      : exportRatio >= 40
        ? {
            title: 'Export and self-consumption',
            body: `${formatPercent(exportRatio)} of generation was exported, while roughly ${formatPercent(selfConsumptionRatio)} was used onsite. This reads as a day with meaningful excess solar beyond household demand.`,
            tone: 'neutral',
          }
        : {
            title: 'Export and self-consumption',
            body: `About ${formatPercent(selfConsumptionRatio)} of generation stayed in the home, with ${formatPercent(exportRatio)} exported. Most of the solar value came through self-consumption rather than export.`,
            tone: 'good',
          };

  const trustNote: HistoricalNote = isPartialDay || hasTrustWarning
    ? {
        title: 'Coverage and trust',
        body: hasTrustWarning
          ? `Provider coverage landed at about ${formatPercent(completenessRatio)} for this date and at least one trust warning was raised, so the day story should be read as directional rather than exact.`
          : `Provider coverage landed at about ${formatPercent(completenessRatio)} for this date, so totals remain useful but should be read as a partial-day picture rather than a complete daily record.`,
        tone: 'caution',
      }
    : {
        title: 'Coverage and trust',
        body: `Provider coverage was complete for the selected day, so the totals and interpretation can be read as a full-day summary.`,
        tone: 'good',
      };

  const financialNote: HistoricalNote =
    hasTariff && financialEstimate
      ? {
          title: 'Tariff-aware value',
          body:
            financialEstimate.netBillImpact < 0
              ? `Solar and export produced an estimated net credit of ${formatEuro(Math.abs(financialEstimate.netBillImpact))} for the day, including ${formatEuro(financialEstimate.exportCredit)} of export credit and ${formatEuro(financialEstimate.solarSavings)} of solar savings. This remains a simplified day-rate estimate rather than a full bill reconstruction.`
              : `Estimated net bill impact for the day was ${formatEuro(financialEstimate.netBillImpact)}, including ${formatEuro(financialEstimate.exportCredit)} of export credit and ${formatEuro(financialEstimate.solarSavings)} of solar savings. This remains a simplified day-rate estimate rather than a full bill reconstruction.`,
          tone: 'neutral',
        }
      : {
          title: 'Tariff-aware value',
          body: 'Tariff data was not available for this date, so financial claims are intentionally omitted while the energy interpretation remains available.',
          tone: 'neutral',
        };

  return {
    heading: 'Day story',
    summary: 'A calm interpretation of the selected day using only that day’s energy and trust signals.',
    notes: [generationNote, gridNote, mixNote, trustNote, financialNote],
  };
}
