/** URLs públicas de media no proxy R2 (Edge `r2-media`). */

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

export function r2PublicMediaUrl(bucket: string, objectPath: string): string {
  const base = supabaseBase();
  const rest = objectPath
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/functions/v1/r2-media/espelho/${encodeURIComponent(bucket)}/${rest}`;
}

/** Reescreve URLs públicas do Storage Supabase para o proxy R2. */
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
  return `${supabaseUrl}/functions/v1/r2-media/espelho/${rest}${u.search}`;
}
