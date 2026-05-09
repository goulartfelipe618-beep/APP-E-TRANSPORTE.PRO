import { isMapboxConfigured, mapboxForwardGeocode } from "@/lib/mapboxGeocode";

export type MapboxResolvedPlace = {
  placeName: string;
  lat: number;
  lng: number;
};

/**
 * Geocodifica o texto livre e devolve o endereço canónico do Mapbox (primeiro resultado).
 * Usado para gravar endereços que o PDF e as rotas estáticas conseguem resolver bem.
 */
export async function resolveAddressViaMapbox(query: string): Promise<MapboxResolvedPlace | null> {
  const q = query.trim();
  if (!isMapboxConfigured() || q.length < 3) return null;
  const hits = await mapboxForwardGeocode(q);
  const h = hits[0];
  if (!h) return null;
  return { placeName: h.place_name, lat: h.lat, lng: h.lng };
}
