/** Reescreve URLs públicas do Storage Supabase para o proxy R2 (mesma origem do projecto). */

export function rewriteSupabaseStorageUrlToR2(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  const marker = "/storage/v1/object/public/";
  const idx = u.pathname.indexOf(marker);
  if (idx < 0) return null;
  const rest = u.pathname.slice(idx + marker.length);
  if (!rest) return null;
  const supabaseUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL
    ? String(import.meta.env.VITE_SUPABASE_URL)
    : "").replace(/\/+$/, "");
  if (!supabaseUrl) return null;
  try {
    if (u.hostname !== new URL(supabaseUrl).hostname) return null;
  } catch {
    return null;
  }
  return `${supabaseUrl}/functions/v1/r2-media/espelho/${rest}${u.search}`;
}
