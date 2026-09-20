/**
 * Geocodificação via Nominatim (OpenStreetMap) para fallback quando não há lat/lng no perfil.
 * Política de uso: máx. ~1 requisição/segundo (ver https://operations.osmfoundation.org/policies/nominatim/).
 */
const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

export function nominatimDelayMs(): number {
  return 1100;
}

const FETCH_TIMEOUT_MS = 4000;

export async function nominatimGeocode(query: string): Promise<[number, number] | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const ac = new AbortController();
  const timer = globalThis.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data?.[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lat, lng];
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}
