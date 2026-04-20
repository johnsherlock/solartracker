import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — factories must be self-contained (no outer variable refs)
vi.mock('@/src/db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('@/src/weather/openMeteoAdapter', () => ({
  fetchOpenMeteo: vi.fn(),
  normalizeHourlyForecast: vi.fn(),
  normalizeDailyForecast: vi.fn(),
}));

vi.mock('@/src/weather/sunPosition', () => ({
  computeSunPosition: vi.fn(() => ({
    computedAtUtc: '2024-06-21T01:00:00Z',
    elevationDegrees: -20,
    azimuthDegrees: 0,
    isAboveHorizon: false,
    daylightRemainingSeconds: 0,
  })),
  formatDaylightStatus: vi.fn(() => ({ label: 'Until sunrise', value: '5h 0m' })),
}));

// Import after mocks
import { getLiveWeatherContext } from '../getLiveWeatherContext';
import { db } from '@/src/db/client';
import * as adapter from '@/src/weather/openMeteoAdapter';

// ---------------------------------------------------------------------------
// Helpers to reach into the mock chain
// ---------------------------------------------------------------------------

function setDbRows(rows: object[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock  = vi.fn(() => ({ where: whereMock }));
  vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DB_ROW = {
  locationLatitude: '51.8985',
  locationLongitude: '-8.4756',
  locationPrecisionMode: 'exact',
  locationDisplayName: 'Cork, Ireland',
  locationLocality: 'Cork',
  timezone: 'Europe/Dublin',
};

const HOURLY     = { slots: [] };
const DAILY      = { days: [] };
const SUN_EVENTS = {
  localDate: '2024-06-21',
  sunriseUtc: '2024-06-21T05:00:00Z',
  sunsetUtc: '2024-06-21T21:30:00Z',
  solarNoonUtc: '2024-06-21T13:15:00Z',
  daylightSeconds: 59400,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getLiveWeatherContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDbRows([DB_ROW]);
  });

  it('returns no-location when the installation has no coordinates', async () => {
    setDbRows([{ ...DB_ROW, locationLatitude: null, locationLongitude: null }]);
    expect((await getLiveWeatherContext('test-id')).status).toBe('no-location');
  });

  it('returns no-location when the installation row is missing', async () => {
    setDbRows([]);
    expect((await getLiveWeatherContext('test-id')).status).toBe('no-location');
  });

  it('returns forecast-unavailable when the API throws', async () => {
    vi.mocked(adapter.fetchOpenMeteo).mockRejectedValue(new Error('Network error'));
    expect((await getLiveWeatherContext('test-id')).status).toBe('forecast-unavailable');
  });

  it('still includes a sun position when the forecast API fails', async () => {
    vi.mocked(adapter.fetchOpenMeteo).mockRejectedValue(new Error('timeout'));
    const result = await getLiveWeatherContext('test-id');
    expect(result.status).toBe('forecast-unavailable');
    if (result.status === 'forecast-unavailable') {
      expect(result.sunPosition).toBeDefined();
      expect(result.sunPosition.computedAtUtc).toBeDefined();
    }
  });

  it('returns ok when the API succeeds', async () => {
    vi.mocked(adapter.fetchOpenMeteo).mockResolvedValue({} as never);
    vi.mocked(adapter.normalizeHourlyForecast).mockReturnValue(HOURLY as never);
    vi.mocked(adapter.normalizeDailyForecast).mockReturnValue({ dailyForecast: DAILY, sunEvents: SUN_EVENTS } as never);
    expect((await getLiveWeatherContext('test-id')).status).toBe('ok');
  });

  it('includes location metadata with exact precision', async () => {
    vi.mocked(adapter.fetchOpenMeteo).mockResolvedValue({} as never);
    vi.mocked(adapter.normalizeHourlyForecast).mockReturnValue(HOURLY as never);
    vi.mocked(adapter.normalizeDailyForecast).mockReturnValue({ dailyForecast: DAILY, sunEvents: SUN_EVENTS } as never);
    const result = await getLiveWeatherContext('test-id');
    if (result.status === 'ok') {
      expect(result.data.location.precisionMode).toBe('exact');
      expect(result.data.location.displayName).toBe('Cork, Ireland');
    }
  });

  it('uses locality as display name for approximate precision', async () => {
    setDbRows([{ ...DB_ROW, locationPrecisionMode: 'approximate' }]);
    vi.mocked(adapter.fetchOpenMeteo).mockResolvedValue({} as never);
    vi.mocked(adapter.normalizeHourlyForecast).mockReturnValue(HOURLY as never);
    vi.mocked(adapter.normalizeDailyForecast).mockReturnValue({ dailyForecast: DAILY, sunEvents: SUN_EVENTS } as never);
    const result = await getLiveWeatherContext('test-id');
    if (result.status === 'ok') {
      expect(result.data.location.precisionMode).toBe('approximate');
      expect(result.data.location.displayName).toBe('Cork');
    }
  });
});
