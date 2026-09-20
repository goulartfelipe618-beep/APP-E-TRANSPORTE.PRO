/**
 * Imagens públicas: redireciona (302) para URL assinada do R2.
 * O ficheiro é descarregado no Cloudflare, não atravessa o body da Edge Function.
 * Se R2_PUBLIC_BASE_URL (domínio custom do bucket) existir, redireciona para esse CDN.
 */
import { PUBLIC_STORAGE_BUCKETS, publicObjectUrl, r2Client, r2PresignGet } from "../_shared/r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  let raw = url.pathname;
  const idx = raw.toLowerCase().indexOf("/r2-media/");
  if (idx >= 0) raw = raw.slice(idx + "/r2-media/".length);
  else raw = raw.replace(/^\/+/, "");
  const key = decodeURIComponent(raw.replace(/^\/+/, ""));
  if (!key.startsWith("espelho/") && !key.startsWith("organizado/")) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const bucketFromKey = (() => {
    if (key.startsWith("espelho/")) return key.split("/")[1] ?? "";
    const parts = key.split("/");
    if (parts[1] === "plataforma") return parts[2] ?? "";
    if (parts[1] === "usuarios") return parts[4] ?? "";
    return "";
  })();
  if (!PUBLIC_STORAGE_BUCKETS.has(bucketFromKey)) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const cdnUrl = publicObjectUrl(key, supabaseUrl);
  if (!cdnUrl.includes("/functions/v1/r2-media/")) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: cdnUrl, "Cache-Control": "public, max-age=300" },
    });
  }

  let r2;
  try {
    r2 = r2Client();
  } catch {
    return new Response("R2 não configurado", { status: 503, headers: corsHeaders });
  }

  try {
    const location = await r2PresignGet(r2, key, 86400);
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: location,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
});
