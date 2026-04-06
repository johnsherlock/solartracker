// WMO Weather Interpretation Code mapping
// https://open-meteo.com/en/docs — "WMO Weather interpretation codes (WW)"

export type WmoInfo = {
  label: string;
  // Lucide icon name — used by the UI to pick the right icon component.
  // Day/night variants handled by the caller based on HourlyForecastSlot.isDay.
  dayIcon: string;
  nightIcon: string;
};

const WMO_MAP: Record<number, WmoInfo> = {
  0:  { label: 'Clear sky',            dayIcon: 'Sun',            nightIcon: 'Moon' },
  1:  { label: 'Mainly clear',         dayIcon: 'CloudSun',       nightIcon: 'CloudMoon' },
  2:  { label: 'Partly cloudy',        dayIcon: 'CloudSun',       nightIcon: 'CloudMoon' },
  3:  { label: 'Overcast',             dayIcon: 'Cloudy',         nightIcon: 'Cloudy' },
  45: { label: 'Fog',                  dayIcon: 'CloudFog',       nightIcon: 'CloudFog' },
  48: { label: 'Icy fog',              dayIcon: 'CloudFog',       nightIcon: 'CloudFog' },
  51: { label: 'Light drizzle',        dayIcon: 'CloudDrizzle',   nightIcon: 'CloudDrizzle' },
  53: { label: 'Drizzle',              dayIcon: 'CloudDrizzle',   nightIcon: 'CloudDrizzle' },
  55: { label: 'Heavy drizzle',        dayIcon: 'CloudDrizzle',   nightIcon: 'CloudDrizzle' },
  56: { label: 'Freezing drizzle',     dayIcon: 'CloudDrizzle',   nightIcon: 'CloudDrizzle' },
  57: { label: 'Heavy freezing drizzle', dayIcon: 'CloudDrizzle', nightIcon: 'CloudDrizzle' },
  61: { label: 'Light rain',           dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  63: { label: 'Rain',                 dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  65: { label: 'Heavy rain',           dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  66: { label: 'Freezing rain',        dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  67: { label: 'Heavy freezing rain',  dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  71: { label: 'Light snow',           dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  73: { label: 'Snow',                 dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  75: { label: 'Heavy snow',           dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  77: { label: 'Snow grains',          dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  80: { label: 'Light showers',        dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  81: { label: 'Showers',              dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  82: { label: 'Heavy showers',        dayIcon: 'CloudRain',      nightIcon: 'CloudRain' },
  85: { label: 'Snow showers',         dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  86: { label: 'Heavy snow showers',   dayIcon: 'CloudSnow',      nightIcon: 'CloudSnow' },
  95: { label: 'Thunderstorm',         dayIcon: 'CloudLightning',  nightIcon: 'CloudLightning' },
  96: { label: 'Thunderstorm w/ hail', dayIcon: 'CloudLightning',  nightIcon: 'CloudLightning' },
  99: { label: 'Thunderstorm w/ heavy hail', dayIcon: 'CloudLightning', nightIcon: 'CloudLightning' },
};

const FALLBACK: WmoInfo = { label: 'Unknown', dayIcon: 'Cloud', nightIcon: 'Cloud' };

export function getWmoInfo(code: number): WmoInfo {
  return WMO_MAP[code] ?? FALLBACK;
}

export function getWmoLabel(code: number): string {
  return getWmoInfo(code).label;
}
