import { isMapboxConfigured } from "@/lib/mapboxGeocode";
import { geocodeAddressWithBias } from "@/lib/mapboxResolveAddress";

const STATIC_W = 640;
const STATIC_H = 240;
/** Limite da API Static Images (~8192); margem para overlay + token. */
const MAX_URL_SAFE_LEN = 7200;

const STATIC_PADDING = "28,28,32,28";

/**
 * Polilinha codificada (precision 5) — formato exigido pelo parâmetro `path` da Mapbox Static Images API.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodePolylinePrecision5(coords: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  const factor = 1e5;
  for (const [lng, lat] of coords) {
    const latE5 = Math.round(lat * factor);
    const lngE5 = Math.round(lng * factor);
    const dLat = latE5 - lastLat;
    const dLng = lngE5 - lastLng;
    lastLat = latE5;
    lastLng = lngE5;
    out += encodeSignedChunk(dLat);
    out += encodeSignedChunk(dLng);
  }
  return out;
}

function encodeSignedChunk(num: number): string {
  let s = num << 1;
  if (num < 0) s = ~s;
  let chunk = "";
  while (s >= 0x20) {
    chunk += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
    s >>= 5;
  }
  chunk += String.fromCharCode(s + 63);
  return chunk;
}

function decimateCoords(coords: [number, number][], maxPoints: number): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * (coords.length - 1));
    const c = coords[idx];
    if (c) out.push([c[0], c[1]]);
  }
  return out;
}

function bboxFromCoords(coords: [number, number][], padRatio: number): [number, number, number, number] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const dLng = Math.max(maxLng - minLng, 1e-4);
  const dLat = Math.max(maxLat - minLat, 1e-4);
  const px = dLng * padRatio;
  const py = dLat * padRatio;
  return [minLng - px, minLat - py, maxLng + px, maxLat + py];
}

async function geocodeFirst(query: string | null | undefined): Promise<{ lng: number; lat: number } | null> {
  const q = (query ?? "").trim();
  if (q.length < 3) return null;
  const hit = await geocodeAddressWithBias(q);
  if (!hit) return null;
  return { lng: hit.lng, lat: hit.lat };
}

async function fetchDrivingCoordinates(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  token: string,
): Promise<[number, number][]> {
  const pair = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${pair}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
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

function buildOverlayWithEncodedPath(
  pathCoords: [number, number][],
  maxPoints: number,
): { overlay: string; urlLengthApprox: number } | null {
  const line = decimateCoords(pathCoords, maxPoints);
  if (line.length < 2) return null;
  const start = line[0]!;
  const end = line[line.length - 1]!;
  const encodedRaw = encodePolylinePrecision5(line);
  const encodedPoly = encodeURIComponent(encodedRaw);
  const pinA = `pin-s-a+FF6600(${start[0].toFixed(6)},${start[1].toFixed(6)})`;
  const pinB = `pin-s-b+FF6600(${end[0].toFixed(6)},${end[1].toFixed(6)})`;
  const pathPart = `path-6+FF6600-1(${encodedPoly})`;
  const overlay = `${pinA},${pinB},${pathPart}`;
  const approx = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/auto/${STATIC_W}x${STATIC_H}@2x`.length + 120;
  return { overlay, urlLengthApprox: approx };
}

function buildStaticRequestUrl(
  overlay: string,
  token: string,
  bbox: [number, number, number, number] | null,
): string {
  const size = `${STATIC_W}x${STATIC_H}@2x`;
  const position = bbox
    ? `[${bbox[0].toFixed(6)},${bbox[1].toFixed(6)},${bbox[2].toFixed(6)},${bbox[3].toFixed(6)}]`
    : "auto";
  const path = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/${position}/${size}`;
  const q = new URLSearchParams({ access_token: token, padding: STATIC_PADDING });
  return `${path}?${q.toString()}`;
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
 * Imagem PNG com rota de condução (Directions) entre dois endereços.
 * Usa polilinha codificada na Static API (obrigatório) + bbox para enquadrar só o trajeto.
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

  let overlay: string | null = null;
  let bbox: [number, number, number, number] | null = null;

  for (const maxPts of [120, 80, 50, 35, 25]) {
    const built = buildOverlayWithEncodedPath(pathCoords, maxPts);
    if (!built) continue;
    if (built.urlLengthApprox <= MAX_URL_SAFE_LEN) {
      overlay = built.overlay;
      bbox = bboxFromCoords(decimateCoords(pathCoords, maxPts), 0.12);
      break;
    }
  }

  if (!overlay) {
    const built = buildOverlayWithEncodedPath(pathCoords, 20);
    if (!built) return null;
    overlay = built.overlay;
    bbox = bboxFromCoords(pathCoords, 0.12);
  }

  const staticUrl = buildStaticRequestUrl(overlay, token, bbox);

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
