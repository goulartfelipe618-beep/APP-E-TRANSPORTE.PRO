const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

export type MapboxSuggestion = {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  cidade?: string;
  estado?: string;
};

function parseContext(context: { id: string; text: string; short_code?: string }[] | undefined) {
  let cidade: string | undefined;
  let estado: string | undefined;
  if (!context) return { cidade, estado };
  for (const c of context) {
    if (c.id.startsWith("place")) cidade = c.text;
    if (c.id.startsWith("region")) {
      estado = c.short_code?.replace(/^BR-/, "") || c.text;
    }
  }
  return { cidade, estado };
}

/** Geocodificação forward (Mapbox Places API). */
export async function mapboxForwardGeocode(query: string): Promise<MapboxSuggestion[]> {
  const q = query.trim();
  if (!MAPBOX_TOKEN || q.length < 3) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "BR");
  url.searchParams.set("language", "pt");
  url.searchParams.set("limit", "6");
  url.searchParams.set("types", "address,place,locality,neighborhood,region,postcode");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: Array<{
      id: string;
      place_name: string;
      center?: [number, number];
      context?: { id: string; text: string; short_code?: string }[];
    }>;
  };

  const out: MapboxSuggestion[] = [];
  for (const f of json.features || []) {
    const c = f.center;
    if (!c || c.length < 2) continue;
    const [lng, lat] = c;
    const { cidade, estado } = parseContext(f.context);
    out.push({
      id: f.id,
      place_name: f.place_name,
      lat,
      lng,
      cidade,
      estado,
    });
  }
  return out;
}

/** Busca focada em cidades, bairros e regiões (área de atendimento SAB), sem endereços de rua. */
export async function mapboxForwardGeocodeServiceAreas(query: string): Promise<MapboxSuggestion[]> {
  const q = query.trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "BR");
  url.searchParams.set("language", "pt");
  url.searchParams.set("limit", "8");
  url.searchParams.set("types", "region,place,locality,neighborhood,district");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: Array<{
      id: string;
      place_name: string;
      center?: [number, number];
      context?: { id: string; text: string; short_code?: string }[];
    }>;
  };

  const out: MapboxSuggestion[] = [];
  for (const f of json.features || []) {
    const c = f.center;
    if (!c || c.length < 2) continue;
    const [lng, lat] = c;
    const { cidade, estado } = parseContext(f.context);
    out.push({
      id: f.id,
      place_name: f.place_name,
      lat,
      lng,
      cidade,
      estado,
    });
  }
  return out;
}

export function isMapboxConfigured(): boolean {
  return Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.length > 20);
}
