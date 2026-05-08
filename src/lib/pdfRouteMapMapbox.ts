import { isMapboxConfigured, mapboxForwardGeocode } from "@/lib/mapboxGeocode";

const STATIC_W = 640;
const STATIC_H = 240;

async function geocodeFirst(query: string | null | undefined): Promise<{ lng: number; lat: number } | null> {
  const q = (query ?? "").trim();
  if (q.length < 3) return null;
  const hits = await mapboxForwardGeocode(q);
  const h = hits[0];
  if (!h) return null;
  return { lng: h.lng, lat: h.lat };
}

async function fetchDrivingCoordinates(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  token: string,
): Promise<[number, number][]> {
  const pair = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${pair}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "simplified");
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ];
    const json = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = json.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ];
    }
    return coords;
  } catch {
    return [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ];
  }
}

function simplifyCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (coords.length - 1));
    const c = coords[idx];
    if (c) out.push([Number(c[0].toFixed(5)), Number(c[1].toFixed(5))]);
  }
  return out;
}

function buildPathOverlay(coords: [number, number][]): string {
  const flat = simplifyCoords(coords, 28).flatMap(([lng, lat]) => [`${lng}`, `${lat}`]);
  return `path-5+FF6600-0.9(${flat.join(",")})`;
}

function buildStaticOverlay(
  origin: { lng: number; lat: number },
  dest: { lng: number; lat: number },
  pathCoords: [number, number][],
): string {
  const pinA = `pin-s-a+FF6600(${origin.lng.toFixed(5)},${origin.lat.toFixed(5)})`;
  const pinB = `pin-s-b+FF6600(${dest.lng.toFixed(5)},${dest.lat.toFixed(5)})`;
  const same =
    Math.abs(origin.lng - dest.lng) < 0.0002 && Math.abs(origin.lat - dest.lat) < 0.0002;
  if (same) return pinA;
  return `${pinA},${pinB},${buildPathOverlay(pathCoords)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(blob);
  });
}

/**
 * Obtém imagem PNG/JPEG (data URL) com rota aproximada entre dois endereços (Mapbox Geocoding + Directions + Static Images).
 * Requer `VITE_MAPBOX_ACCESS_TOKEN`. Retorna null se não configurado, endereços vazios ou falha de rede/API.
 */
export async function fetchRouteMapImageDataUrl(
  originAddress: string | null | undefined,
  destAddress: string | null | undefined,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
  if (!token || !isMapboxConfigured()) return null;

  const o = (originAddress ?? "").trim();
  const d = (destAddress ?? "").trim();
  if (!o || !d) return null;

  const [from, to] = await Promise.all([geocodeFirst(o), geocodeFirst(d)]);
  if (!from || !to) return null;

  const pathCoords = await fetchDrivingCoordinates(from, to, token);
  const overlay = buildStaticOverlay(from, to, pathCoords);
  const encodedOverlay = encodeURIComponent(overlay);
  const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${encodedOverlay}/auto/${STATIC_W}x${STATIC_H}@2x?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(staticUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    const mime = blob.type || "";
    const format: "PNG" | "JPEG" = mime.includes("jpeg") ? "JPEG" : "PNG";
    return { dataUrl, format };
  } catch {
    return null;
  }
}
