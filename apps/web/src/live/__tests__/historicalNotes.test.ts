import { describe, expect, it } from 'vitest';
import { buildHistoricalNotesModel } from '../historicalNotes';

const baseTotals = {
  generatedKwh: 18,
  consumedKwh: 20,
  importKwh: 4,
  exportKwh: 3,
  immersionDivertedKwh: 0,
};

const baseHealth = {
  expectedMinutes: 1440,
  coveredMinutes: 1440,
  uptimePercent: 100,
  incidents: [],
};

describe('buildHistoricalNotesModel', () => {
  it('builds a complete-day story with tariff-aware messaging', () => {
    const model = buildHistoricalNotesModel({
      screenState: 'healthy',
      dayTotals: baseTotals,
      health: baseHealth,
      hasTariff: true,
      financialEstimate: {
        importCost: 1.5,
        exportCredit: 0.8,
        solarSavings: 4.2,
        netBillImpact: 0.7,
        note: 'simplified-daily-rate',
      },
    });

    expect(model.heading).toBe('Day story');
    expect(model.notes).toHaveLength(5);
    expect(model.notes.find((note) => note.title === 'Coverage and trust')?.body).toContain(
      'complete',
    );
    expect(model.notes.find((note) => note.title === 'Tariff-aware value')?.body).toContain(
      'Estimated net bill impact',
    );
  });

  it('caveats partial-day states clearly', () => {
    const model = buildHistoricalNotesModel({
      screenState: 'healthy',
      dayTotals: baseTotals,
      health: { ...baseHealth, coveredMinutes: 900, uptimePercent: 63 },
      hasTariff: true,
      financialEstimate: {
        importCost: 1.5,
        exportCredit: 0.8,
        solarSavings: 4.2,
        netBillImpact: 0.7,
        note: 'simplified-daily-rate',
      },
    });

    expect(model.notes.find((note) => note.title === 'Coverage and trust')?.body).toContain(
      'partial-day picture',
    );
  });

  it('omits unsupported financial claims when tariff data is missing', () => {
    const model = buildHistoricalNotesModel({
      screenState: 'healthy',
      dayTotals: baseTotals,
      health: baseHealth,
      hasTariff: false,
      financialEstimate: null,
    });

    expect(model.notes.find((note) => note.title === 'Tariff-aware value')?.body).toContain(
      'financial claims are intentionally omitted',
    );
  });

  it('softens trust language when warnings are present', () => {
    const model = buildHistoricalNotesModel({
      screenState: 'warning',
      dayTotals: baseTotals,
      health: { ...baseHealth, coveredMinutes: 1200, incidents: [{ id: 'gap-1' }] },
      hasTariff: true,
      financialEstimate: {
        importCost: 1.5,
        exportCredit: 0.8,
        solarSavings: 4.2,
        netBillImpact: 0.7,
        note: 'simplified-daily-rate',
      },
    });

    expect(model.notes.find((note) => note.title === 'Coverage and trust')?.body).toContain(
      'directional rather than exact',
    );
  });

  it('uses credit language when netBillImpact is negative', () => {
    const model = buildHistoricalNotesModel({
      screenState: 'healthy',
      dayTotals: baseTotals,
      health: baseHealth,
      hasTariff: true,
      financialEstimate: {
        importCost: 0.5,
        exportCredit: 2.0,
        solarSavings: 4.2,
        netBillImpact: -1.5,
        note: 'simplified-daily-rate',
      },
    });

    expect(model.notes.find((note) => note.title === 'Tariff-aware value')?.body).toContain(
      'net credit',
    );
  });
});
