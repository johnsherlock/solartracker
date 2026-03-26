export const formatDecimal = (number: number = 0, decimalPlaces: number = 2): number => {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(number * factor) / factor;
};

export const convertJoulesToKwh = (joules: number = 0, round?: boolean): number => round ? formatDecimal(joules / 3600000) : joules / 3600000;

export const convertJoulesToKw = (energy: number): number => {
  // Calculate power in watts
  const powerWatts = energy / 60;
  // Convert power to kilowatts
  return powerWatts / 1000;
};

export const formatToEuro = (amount: number = 0): string => `€${amount.toFixed(2)}`;