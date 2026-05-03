/**
 * Material HMAC para JWT do selo do motorista.
 * 1) Preferir MOTORISTA_VERIFICACAO_JWT_SECRET (Edge Function secrets / `supabase secrets set`).
 * 2) Se vazio ou <16 chars, derivar de SUPABASE_SERVICE_ROLE_KEY (sempre injectado nas functions),
 *    para ambientes onde o secret manual não chega ao runtime (propagação / UI errada).
 */
export async function resolveMotoristaJwtSecret(): Promise<string> {
  const primary = (Deno.env.get("MOTORISTA_VERIFICACAO_JWT_SECRET") || "").trim();
  if (primary.length >= 16) return primary;

  const sr = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (sr.length < 32) return "";

  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`motorista-selo-jwt-v1|${sr}`));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
