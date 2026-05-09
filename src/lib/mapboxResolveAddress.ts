import {
  isMapboxConfigured,
  mapboxForwardGeocode,
  parseEnvMapboxDefaultProximity,
  type MapboxSuggestion,
} from "@/lib/mapboxGeocode";

export type MapboxResolvedPlace = {
  placeName: string;
  lat: number;
  lng: number;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s1 + s2)));
}

/**
 * Extrai um fragmento após vírgulas para geocodificar como cidade/localidade
 * (ex.: "Rua X 100, Centro, Curitiba" → "Curitiba, Brasil").
 */
export function extractLocalityHintForBias(query: string): string | null {
  const raw = query.trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1]!;
  if (last.length === 2 && /^[A-Za-z]{2}$/.test(last) && parts.length >= 2) {
    const city = parts[parts.length - 2]!;
    if (city.length < 2) return null;
    return `${city}, ${last.toUpperCase()}, Brasil`;
  }

  if (last.length < 3) return null;
  return `${last}, Brasil`;
}

function normalizeHintToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickBestSuggestion(
  hits: MapboxSuggestion[],
  originalQuery: string,
  localityHint: string | null,
  biasCenter: { lng: number; lat: number } | null,
): MapboxSuggestion | null {
  if (hits.length === 0) return null;
  const qNorm = normalizeHintToken(originalQuery);
  const hintCityNorm = localityHint ? normalizeHintToken(localityHint.replace(/,?\s*Brasil\s*$/i, "")) : "";

  let best: MapboxSuggestion = hits[0]!;
  let bestScore = -Infinity;

  for (const h of hits) {
    let score = 0;
    const nameNorm = normalizeHintToken(h.place_name);
    const types = h.place_type ?? [];

    if (types.includes("address")) score += 45;
    if (types.includes("poi")) score += 20;
    if (types.includes("place") || types.includes("locality")) score += 5;

    if (hintCityNorm) {
      const parts = hintCityNorm.split(",").map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (p.length >= 3 && nameNorm.includes(p)) score += 40;
      }
    }

    const tokens = qNorm.split(/[\s,]+/).filter((t) => t.length >= 3);
    for (const t of tokens) {
      if (nameNorm.includes(t)) score += 2;
    }

    if (biasCenter) {
      const d = haversineKm({ lat: h.lat, lng: h.lng }, { lat: biasCenter.lat, lng: biasCenter.lng });
      score -= Math.min(d * 0.35, 70);
      if (hintCityNorm && d > 280) score -= 120;
    }

    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }

  if (biasCenter && hintCityNorm) {
    const dBest = haversineKm({ lat: best.lat, lng: best.lng }, { lat: biasCenter.lat, lng: biasCenter.lng });
    if (dBest > 400) {
      const closer = hits.find((h) => haversineKm({ lat: h.lat, lng: h.lng }, biasCenter) <= 350);
      if (closer) return closer;
    }
  }

  return best;
}

async function resolveLocalityBiasCenter(
  hint: string,
  originalQuery: string,
): Promise<{ lng: number; lat: number } | null> {
  const placeHits = await mapboxForwardGeocode(hint, {
    types: "place,locality",
    limit: 8,
    applyDefaultProximity: false,
  });
  if (!placeHits.length) return null;
  const qn = normalizeHintToken(originalQuery);
  let best = placeHits[0]!;
  let bestScore = -Infinity;
  for (const p of placeHits) {
    let s = 0;
    const pn = normalizeHintToken(p.place_name);
    const cidadeN = p.cidade ? normalizeHintToken(p.cidade) : "";
    if (cidadeN && qn.includes(cidadeN)) s += 35;
    for (const t of qn.split(/[\s,]+/).filter((x) => x.length >= 4)) {
      if (pn.includes(t)) s += 4;
    }
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return { lng: best.lng, lat: best.lat };
}

/**
 * Geocodifica com viés regional: cidade após vírgulas + opcional VITE_MAPBOX_DEFAULT_PROXIMITY.
 * Preferência por resultados tipo `address` e penalização por distância ao centro da localidade.
 */
export async function geocodeAddressWithBias(query: string): Promise<MapboxResolvedPlace | null> {
  const q = query.trim();
  if (!isMapboxConfigured() || q.length < 3) return null;

  const envProx = parseEnvMapboxDefaultProximity();
  const localityHint = extractLocalityHintForBias(q);

  let biasCenter: { lng: number; lat: number } | null = null;
  if (localityHint) {
    biasCenter = await resolveLocalityBiasCenter(localityHint, q);
  }
  if (!biasCenter && envProx) {
    biasCenter = envProx;
  }

  const proximity = biasCenter ?? envProx ?? undefined;

  const hits = await mapboxForwardGeocode(q, {
    proximity,
    types: "address,poi,place,locality,neighborhood,postcode",
    limit: 10,
  });

  const picked = pickBestSuggestion(hits, q, localityHint, biasCenter);
  if (!picked) return null;
  return { placeName: picked.place_name, lat: picked.lat, lng: picked.lng };
}

/**
 * Geocodifica o texto livre e devolve o endereço canónico do Mapbox (melhor candidato com viés regional).
 */
export async function resolveAddressViaMapbox(query: string): Promise<MapboxResolvedPlace | null> {
  return geocodeAddressWithBias(query);
}
