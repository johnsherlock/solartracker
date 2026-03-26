import { EnergyCalculator } from '../energy-calculator';

const energyCalculator: EnergyCalculator = new EnergyCalculator({
  dayRate: 0.4673,
  peakRate: 0.5709,
  nightRate: 0.3434,
  exportRate: 0.1850,
  discountPercentage: 0.15,
  annualStandingCharge: 257.91,
  monthlyPsoCharge: 0.1,
});

describe('EnergyCalculator', () => {

  describe('calculateHourlyNetCostAtStandardRates', () => {
    it('should return the cost using day rate if hour is between 8-16 and day is not Sat', () => {
      // This test should return a value of 1.04 because the input hour is 12, which is between 8-16,
      // so the cost is calculated using the day rate (0.4673).
      // So the net cost is 2.22 * 0.4673 = 1.04.
      expect(energyCalculator.calculateNetCostAtStandardRates(12, 'Mon', 2.22)).toEqual(1.04);
    });

    it('should return the cost using night rate if hour is 0-8 or 23', () => {
      // This test should return 0.76 for both hours because the input hour is using the night rate (0.3434).
      // The net cost is 2.22 * 0.3434 = 0.76.
      expect(energyCalculator.calculateNetCostAtStandardRates(2, 'Mon', 2.22)).toEqual(0.76);
      expect(energyCalculator.calculateNetCostAtStandardRates(23, 'Mon', 2.22)).toEqual(0.76);
    });

    it('should return the cost using peak rate if hour is 17-19', () => {
      // This test should return 1.27 because the input hour is 18 uses the peak rate (0.5709).
      // So the net cost is 2.22 * 0.5709 = 1.27 when rounded to two decimal places.
      expect(energyCalculator.calculateNetCostAtStandardRates(18, 'Mon', 2.22)).toEqual(1.27);
    });

    it('should return 0 if hour is 9-17 and day is Sat', () => {
      expect(energyCalculator.calculateNetCostAtStandardRates(12, 'Sat', 2.22)).toEqual(0);
    });
  });

  describe('calculateDiscountedHourlyGrossCost', () => {
    it('should return the discounted gross cost using day rate if hour is between 8-16 and day is not Sat', () => {
      // Hour is 12 so the cost is calculated using the day rate (0.4673).
      // The gross cost is 2.22 * 0.4673 = 1.03.
      // A discount of 15% is applied, reducing the gross cost to 1.03 - (1.03 * 0.15) = 0.8771.
      // Finally, VAT of 9% is applied, increasing the cost to 0.8771 + (0.8771 * 0.09) = 0.96
      expect(energyCalculator.calculateDiscountedCostIncludingVat(12, 'Mon', 2.22)).toEqual(0.96);
    });

    it('should return the discounted gross cost using night rate if hour is 0-8 or 23', () => {
      // Cost is calculated using the night rate (0.3434).
      // The gross cost is 2.22 * 0.3434 = 0.76.
      // A discount of 15% is applied, reducing the gross cost to 0.76 - (0.76 * 0.15) = 0.646.
      // Finally, VAT of 9% is applied, increasing the cost to 0.646 + (0.646 * 0.09) = 0.70
      expect(energyCalculator.calculateDiscountedCostIncludingVat(2, 'Mon', 2.22)).toEqual(0.70);
      expect(energyCalculator.calculateDiscountedCostIncludingVat(23, 'Mon', 2.22)).toEqual(0.70);
    });

    it('should return the discounted gross cost using peak rate if hour is 17-19', () => {
      // Cost is calculated using the peak rate (0.5709).
      // To the gross cost is 2.22 * 0.5709 = 1.26.
      // A discount of 15% is applied, reducing the gross cost to 1.26 - (1.26 * 0.15) = 1.08.
      // Finally, VAT of 9% is applied, increasing the cost to 1.08 + (1.08 * 0.09) = 1.18.
      expect(energyCalculator.calculateDiscountedCostIncludingVat(18, 'Mon', 2.22)).toEqual(1.18);
    });

    it('should return 0 if hour is 9-17 and day is Sat', () => {
      expect(energyCalculator.calculateDiscountedCostIncludingVat(12, 'Sat', 2.22)).toEqual(0);
    });
  });

  describe('calculateHourlyGrossCostIncStdChgAndDiscount', () => {
    it('should return the gross cost using night rate if hour is 0-8 or 23, day is Mon and joules is 2.22', () => {
      // Cost is calculated using the night rate (0.3434).
      // To the net cost is 2.22 * 0.3434 = 0.76.
      // A discount of 15% is applied to the net cost, reducing it to 0.76 - (0.76 * 0.15) = 0.646.
      // The hourly standing charge of 0.0294 is added, making the gross cost 0.675.
      // Finally, VAT of 9% is applied, increasing the cost to 0.675 + (0.675 * 0.09) = 0.74.
      expect(energyCalculator.calculateGrossCostPerHourIncStdChgAndDiscount(2, 'Mon', 2.22)).toEqual(0.74);
      expect(energyCalculator.calculateGrossCostPerHourIncStdChgAndDiscount(23, 'Mon', 2.22)).toEqual(0.74);
    });

    it('should return the gross cost using peak rate if hour is 17-19, day is Mon and joules is 2.22', () => {
      // Cost is calculated using the peak rate (0.5709).
      // To the net cost is 2.22 * 0.5709 = 1.26.
      // A discount of 15% is applied to the net cost, reducing it to 1.26 - (1.26 * 0.15) = 1.08.
      // The daily standing charge of 0.0294 is applied, making the net cost 1.11.
      // Finally, VAT of 9% is applied, increasing the cost to 1.11 + (1.11 * 0.09) = 1.21.
      expect(energyCalculator.calculateGrossCostPerHourIncStdChgAndDiscount(18, 'Mon', 2.22)).toEqual(1.21);
    });

    it('should return the gross cost using day rate if hour is 8-16, day is not Sat and joules is 2.22', () => {
      // Cost is calculated using the day rate (0.4673).
      // To the net cost is 2.22 * 0.4673 = 1.03.
      // A discount of 15% is applied to the net cost, reducing it to 1.03 - (1.03 * 0.15) = 0.8745.
      // The hourly standing charge of 0.0294 is added, making the gross cost 0.904.
      // Finally, VAT of 9% is applied, increasing the cost to 0.904 + (0.904 * 0.09) = 0.9936.
      expect(energyCalculator.calculateGrossCostPerHourIncStdChgAndDiscount(12, 'Mon', 2.22)).toEqual(1);
    });
  });

  describe('calculateSaturdaySaving', () => {
    it('returns 0 if day is not Sat', () => {
      // expected value is 0 because day is not Saturday
      expect(energyCalculator.calculateSaturdaySaving(12, 'Sun', 800000)).toEqual(0);
    });

    it('returns 0 if hour is less than 9', () => {
      // expected value is 0 because hour is less than 9
      expect(energyCalculator.calculateSaturdaySaving(8, 'Sat', 800000)).toEqual(0);
    });

    it('returns 0 if hour is greater than 17', () => {
      // expected value is 0 because hour is greater than 17
      expect(energyCalculator.calculateSaturdaySaving(18, 'Sat', 800000)).toEqual(0);
    });

    it('returns the gross saving at discounted rates if joules, day and hour is provided', () => {
      // expected value is calculated based on given formula
      expect(energyCalculator.calculateSaturdaySaving(12, 'Sat', 2.22)).toEqual(0.96);
    });
  });

  describe('calculateDiscountedGrossCostExcludingStdChg', () => {
    it('returns the correct discounted gross cost excluding the standing charge', () => {
      const netCostAtStandardRate = 10;
      expect(energyCalculator.calculateDiscountedGrossCostExcludingStdChg(netCostAtStandardRate)).toEqual(9.27);
    });
  });

  describe('calculateGrossCostIncStandingCharges', () => {
    it('returns the correct gross cost including standing charges', () => {
      const netCost = 10;
      // 9.3 is the expected value because the gross cost is calculated as (netCost + standingCharge) * vatRate.
      // If netCost is 10 and standingCharge is 0.7, then (10 + 0.7) = 10.7.
      // If vatRate is 0.9, then (10.7 * 0.9) = 9.63 which is rounded to two decimal places to give 9.3.
      expect(energyCalculator.calculateGrossCostIncStandingCharges(netCost)).toEqual(9.3);
    });
  });

  describe('calculateExportValue', () => {
    it('should return the correct export value if joules are provided', () => {
      // 2.57 is the expected value because the input joules is 50000000, which when
      // converted to kWh (50000000/3600000) is equal to 13.8888888.
      // The export rate is 0.1850, so the export value is 13.8888888 * 0.1850 = 2.57.
      expect(energyCalculator.calculateExportValue(7.21)).toEqual(1.33);
    });
  });
});
