import { describe, it, expect } from 'vitest';
import { normalizeHourlyForecast, normalizeDailyForecast } from '../openMeteoAdapter';

// ---------------------------------------------------------------------------
// Helpers to build minimal raw Open-Meteo shapes
// ---------------------------------------------------------------------------

function makeHourlyRaw(startUtcMs: number, count: number) {
  const times: string[] = [];
  const temperature: number[] = [];
  const cloud: number[] = [];
  const precip: number[] = [];
  const code: number[] = [];
  const isDay: number[] = [];

  for (let i = 0; i < count; i++) {
    const t = new Date(startUtcMs + i * 3_600_000);
    times.push(t.toISOString());
    temperature.push(15 + i);
    cloud.push(20);
    precip.push(0);
    code.push(1);
    isDay.push(1);
  }

  return {
    hourly: {
      time: times,
      temperature_2m: temperature,
      cloud_cover: cloud,
      precipitation: precip,
      weather_code: code,
      is_day: isDay,
    },
  };
}

function makeDailyRaw(startLocalDate: string, count: number) {
  const times: string[] = [];
  const sunrise: string[] = [];
  const sunset: string[] = [];
  const daylightDuration: number[] = [];
  const maxTemp: number[] = [];
  const minTemp: number[] = [];
  const precipSum: number[] = [];
  const code: number[] = [];

  for (let i = 0; i < count; i++) {
    const [y, m, d] = startLocalDate.split('-').map(Number);
    const date = new Date(y, m - 1, d + i);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    times.push(`${yyyy}-${mm}-${dd}`);
    sunrise.push(`${yyyy}-${mm}-${dd}T06:00:00Z`);
    sunset.push(`${yyyy}-${mm}-${dd}T21:00:00Z`);
    daylightDuration.push(54000); // 15 hours in seconds
    maxTemp.push(20 + i);
    minTemp.push(10 + i);
    precipSum.push(i === 0 ? 0 : 1.5);
    code.push(i === 0 ? 0 : 63);
  }

  return {
    daily: {
      time: times,
      sunrise,
      sunset,
      daylight_duration: daylightDuration,
      temperature_2m_max: maxTemp,
      temperature_2m_min: minTemp,
      precipitation_sum: precipSum,
      weather_code: code,
    },
  };
}

// ---------------------------------------------------------------------------
// normalizeHourlyForecast
// ---------------------------------------------------------------------------

describe('normalizeHourlyForecast', () => {
  it('returns 12 slots starting from the current UTC hour', () => {
    const now = new Date('2024-06-21T14:30:00Z');
    // Raw data starts 2 hours before now so first usable slot is at 14:00
    const startMs = new Date('2024-06-21T12:00:00Z').getTime();
    const raw = makeHourlyRaw(startMs, 20);

    const result = normalizeHourlyForecast(raw, now, 51.8985, -8.4756);

    expect(result.slots).toHaveLength(12);
    // First slot must be >= the current UTC hour
    const firstSlotTime = new Date(result.slots[0].hourUtc).getTime();
    const currentHourMs = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    expect(firstSlotTime).toBeGreaterThanOrEqual(currentHourMs);
  });

  it('includes expected field values in slots', () => {
    const now = new Date('2024-06-21T14:00:00Z');
    const startMs = new Date('2024-06-21T14:00:00Z').getTime();
    const raw = makeHourlyRaw(startMs, 12);

    const result = normalizeHourlyForecast(raw, now, 51.8985, -8.4756);
    const slot = result.slots[0];

    expect(slot.temperatureCelsius).toBe(15);
    expect(slot.cloudCoverPercent).toBe(20);
    expect(slot.precipitationMm).toBe(0);
    expect(slot.weatherCode).toBe(1);
    expect(slot.isDay).toBe(true);
  });

  it('throws when fewer than 12 future slots are available', () => {
    const now = new Date('2024-06-21T14:00:00Z');
    const startMs = new Date('2024-06-21T14:00:00Z').getTime();
    const raw = makeHourlyRaw(startMs, 5); // only 5 slots

    expect(() => normalizeHourlyForecast(raw, now, 51.8985, -8.4756)).toThrow();
  });

  it('throws when hourly data is missing', () => {
    expect(() => normalizeHourlyForecast({}, new Date(), 0, 0)).toThrow();
  });

  it('stores lat/lon on result', () => {
    const now = new Date('2024-06-21T14:00:00Z');
    const startMs = new Date('2024-06-21T14:00:00Z').getTime();
    const raw = makeHourlyRaw(startMs, 20);

    const result = normalizeHourlyForecast(raw, now, 51.8985, -8.4756);

    expect(result.locationLatitude).toBe(51.8985);
    expect(result.locationLongitude).toBe(-8.4756);
  });
});

// ---------------------------------------------------------------------------
// normalizeDailyForecast
// ---------------------------------------------------------------------------

describe('normalizeDailyForecast', () => {
  it('returns 5 daily cards starting from today', () => {
    const today = '2024-06-21';
    const now = new Date('2024-06-21T12:00:00Z');
    const raw = makeDailyRaw(today, 6);

    const { dailyForecast } = normalizeDailyForecast(raw, today, now, 51.8985, -8.4756);

    expect(dailyForecast.days).toHaveLength(5);
    expect(dailyForecast.days[0].localDate).toBe(today);
  });

  it('derives sunEvents from today sunrise/sunset', () => {
    const today = '2024-06-21';
    const now = new Date('2024-06-21T12:00:00Z');
    const raw = makeDailyRaw(today, 6);

    const { sunEvents } = normalizeDailyForecast(raw, today, now, 51.8985, -8.4756);

    expect(sunEvents.localDate).toBe(today);
    expect(new Date(sunEvents.sunriseUtc).getUTCHours()).toBe(6);
    expect(new Date(sunEvents.sunsetUtc).getUTCHours()).toBe(21);
    // solar noon should be midpoint: 13:30 UTC
    expect(new Date(sunEvents.solarNoonUtc).getUTCHours()).toBe(13);
    expect(new Date(sunEvents.solarNoonUtc).getUTCMinutes()).toBe(30);
  });

  it('throws when today is not present in the response', () => {
    const raw = makeDailyRaw('2024-06-22', 6); // starts tomorrow
    expect(() =>
      normalizeDailyForecast(raw, '2024-06-21', new Date(), 0, 0),
    ).toThrow();
  });

  it('throws when fewer than 5 days are available from today', () => {
    const today = '2024-06-21';
    const raw = makeDailyRaw(today, 3); // only 3 days
    expect(() =>
      normalizeDailyForecast(raw, today, new Date(), 0, 0),
    ).toThrow();
  });

  it('rounds temperatures to 1 decimal place', () => {
    const today = '2024-06-21';
    const now = new Date('2024-06-21T12:00:00Z');
    const raw = makeDailyRaw(today, 6);
    // Override first day max temp with a precise value
    raw.daily.temperature_2m_max[0] = 19.999;

    const { dailyForecast } = normalizeDailyForecast(raw, today, now, 51.8985, -8.4756);

    expect(dailyForecast.days[0].temperatureMaxCelsius).toBe(20);
  });
});
