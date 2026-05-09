const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

/** Opcional: `lng,lat` (ex.: centro da operação) para enviesar todas as pesquisas Mapbox. */
export function parseEnvMapboxDefaultProximity(): { lng: number; lat: number } | null {
  const raw = import.meta.env.VITE_MAPBOX_DEFAULT_PROXIMITY as string | undefined;
  if (!raw?.trim()) return null;
  const parts = raw.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { lng: parts[0]!, lat: parts[1]! };
}

export type MapboxSuggestion = {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  cidade?: string;
  estado?: string;
  /** Tipos Mapbox (ex. address, place) — usado para preferir morada vs cidade genérica. */
  place_type?: string[];
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

export type MapboxGeocodeOptions = {
  proximity?: { lng: number; lat: number };
  /** minLon,minLat,maxLon,maxLat — limita resultados à caixa (Mapbox Geocoding). */
  bbox?: [number, number, number, number];
  limit?: number;
  /** Tipos permitidos (lista separada por vírgula). Evite `region` para moradas com rua + cidade. */
  types?: string;
  /**
   * Quando `false`, não usa `VITE_MAPBOX_DEFAULT_PROXIMITY` se `proximity` não for passado
   * (ex.: resolver só o nome da cidade no texto livre).
   */
  applyDefaultProximity?: boolean;
};

/** Geocodificação forward (Mapbox Places API). */
export async function mapboxForwardGeocode(query: string, options?: MapboxGeocodeOptions): Promise<MapboxSuggestion[]> {
  const q = query.trim();
  if (!MAPBOX_TOKEN || q.length < 3) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "BR");
  url.searchParams.set("language", "pt");
  url.searchParams.set("limit", String(options?.limit ?? 6));
  const types =
    options?.types ?? "address,poi,place,locality,neighborhood,postcode";
  url.searchParams.set("types", types);

  const defaultProx =
    options?.applyDefaultProximity === false ? null : parseEnvMapboxDefaultProximity();
  const proximity = options?.proximity ?? defaultProx ?? undefined;
  if (proximity) {
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  }
  if (options?.bbox) {
    const [w, s, e, n] = options.bbox;
    url.searchParams.set("bbox", `${w},${s},${e},${n}`);
  }

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as {
    features?: Array<{
      id: string;
      place_name: string;
      center?: [number, number];
      place_type?: string[];
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
      place_type: f.place_type,
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

  const proximity = parseEnvMapboxDefaultProximity();
  if (proximity) {
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  }

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
