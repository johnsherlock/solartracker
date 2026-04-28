// A single candidate returned by the search/autocomplete path.
export type LocationCandidate = {
  id: string;
  name: string;           // short locality name — stored in approximate mode
  contextLabel: string;   // full label for dropdown: "Blackrock, Leinster, Ireland"
  latitude: number;
  longitude: number;
  countryCode?: string;
  geocoderProvider: string;
};

// A confirmed, precision-resolved location ready to persist.
export type ResolvedLocation = {
  displayName: string;    // what gets stored — name (approx) or contextLabel (exact)
  latitude: number;
  longitude: number;
  precisionMode: 'exact' | 'approximate';
  countryCode?: string;
  locality?: string;
  geocoderProvider: string;
};

export type GeocoderResult =
  | { ok: true; location: ResolvedLocation }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Open-Meteo — search (multi-result, no key required)
// ---------------------------------------------------------------------------

type OpenMeteoResult = {
  id?: number;
  latitude?: number;
  longitude?: number;
  name?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
};

async function searchViaOpenMeteo(text: string, count = 5): Promise<LocationCandidate[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', text);
  url.searchParams.set('count', String(count));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const json = (await res.json()) as { results?: OpenMeteoResult[] };
  return (json.results ?? [])
    .filter((r): r is Required<Pick<OpenMeteoResult, 'latitude' | 'longitude' | 'name'>> & OpenMeteoResult =>
      r.latitude != null && r.longitude != null && r.name != null,
    )
    .map((r) => {
      const parts = [r.name, r.admin1, r.country].filter(Boolean);
      return {
        id: String(r.id ?? `${r.latitude},${r.longitude}`),
        name: r.name,
        contextLabel: parts.join(', '),
        latitude: r.latitude!,
        longitude: r.longitude!,
        countryCode: r.country_code?.toUpperCase(),
        geocoderProvider: 'open-meteo-geocoding',
      };
    });
}

// ---------------------------------------------------------------------------
// Geoapify — search (multi-result, requires key)
// ---------------------------------------------------------------------------

async function searchViaGeoapify(text: string, apiKey: string, count = 5): Promise<LocationCandidate[]> {
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', text);
  url.searchParams.set('limit', String(count));
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const json = (await res.json()) as {
    features?: {
      properties?: {
        place_id?: string;
        lat?: number;
        lon?: number;
        formatted?: string;
        city?: string;
        town?: string;
        county?: string;
        state?: string;
        country?: string;
        country_code?: string;
      };
    }[];
  };

  return (json.features ?? [])
    .filter((f) => f.properties?.lat != null && f.properties?.lon != null)
    .map((f, i) => {
      const p = f.properties!;
      const locality = p.city ?? p.town ?? p.county;
      const parts = [locality, p.state, p.country].filter(Boolean);
      return {
        id: p.place_id ?? String(i),
        name: locality ?? p.formatted ?? text,
        contextLabel: p.formatted ?? parts.join(', '),
        latitude: p.lat!,
        longitude: p.lon!,
        countryCode: p.country_code?.toUpperCase(),
        geocoderProvider: 'geoapify',
      };
    });
}

// ---------------------------------------------------------------------------
// Public: multi-result search (for typeahead)
// ---------------------------------------------------------------------------

export async function searchLocationCandidates(text: string): Promise<LocationCandidate[]> {
  if (!text.trim()) return [];
  const geoapifyKey = process.env.GEOAPIFY_API_KEY;
  return geoapifyKey
    ? searchViaGeoapify(text, geoapifyKey)
    : searchViaOpenMeteo(text);
}

// ---------------------------------------------------------------------------
// Public: resolve a chosen candidate to a storable location.
// Always stores the full context label — no precision mode needed.
// ---------------------------------------------------------------------------

export function resolveCandidate(candidate: LocationCandidate): ResolvedLocation {
  return {
    displayName: candidate.contextLabel,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    precisionMode: 'exact',
    countryCode: candidate.countryCode,
    locality: candidate.name,
    geocoderProvider: candidate.geocoderProvider,
  };
}
