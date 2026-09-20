/** URLs públicas de media no R2 (CDN directo ou redirect curto via `r2-media`). */

export const PUBLIC_R2_BUCKETS = new Set([
  "catalogo-motorista",
  "community-media",
  "fullscreen-banners",
  "login-assets",
  "logos",
  "templates",
  "veiculos-imagens",
  "website-briefing",
]);

function supabaseBase(): string {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL
      ? String(import.meta.env.VITE_SUPABASE_URL)
      : "";
  return raw.replace(/\/+$/, "");
}

/** Domínio público ligado ao bucket R2 (sem secret). Ex.: https://media.e-transporte.pro */
export function r2PublicCdnBase(): string {
  const raw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_R2_PUBLIC_BASE_URL
      ? String(import.meta.env.VITE_R2_PUBLIC_BASE_URL)
      : "";
  return raw.trim().replace(/\/+$/, "");
}

function encodeKeyPath(key: string): string {
  return key
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function r2DirectObjectUrl(objectKey: string): string {
  const cdn = r2PublicCdnBase();
  const rest = encodeKeyPath(objectKey);
  if (cdn) return `${cdn}/${rest}`;
  const base = supabaseBase();
  return `${base}/functions/v1/r2-media/${rest}`;
}

export function r2PublicMediaUrl(bucket: string, objectPath: string): string {
  const rest = objectPath.replace(/^\/+/, "");
  return r2DirectObjectUrl(`espelho/${bucket}/${rest}`);
}

function rewriteR2MediaProxyToCdn(u: URL, supabaseUrl: string): string | null {
  const cdn = r2PublicCdnBase();
  if (!cdn) return null;
  try {
    if (u.hostname !== new URL(supabaseUrl).hostname) return null;
  } catch {
    return null;
  }
  const marker = "/functions/v1/r2-media/";
  const idx = u.pathname.toLowerCase().indexOf(marker);
  if (idx < 0) return null;
  const rest = u.pathname.slice(idx + marker.length);
  if (!rest) return null;
  return `${cdn}/${rest}${u.search}`;
}

/** Reescreve Storage público / proxy r2-media para o CDN R2 quando existir. */
export function rewriteSupabaseStorageUrlToR2(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  const supabaseUrl = supabaseBase();
  if (!supabaseUrl) return null;

  const fromProxy = rewriteR2MediaProxyToCdn(u, supabaseUrl);
  if (fromProxy) return fromProxy;

  try {
    if (u.hostname !== new URL(supabaseUrl).hostname) return null;
  } catch {
    return null;
  }
  if (u.pathname.toLowerCase().includes("/functions/v1/r2-media/")) return t;

  const publicMarker = "/storage/v1/object/public/";
  const idx = u.pathname.indexOf(publicMarker);
  if (idx < 0) return null;
  const rest = u.pathname.slice(idx + publicMarker.length);
  if (!rest) return null;
  return r2DirectObjectUrl(`espelho/${rest}`);
}
