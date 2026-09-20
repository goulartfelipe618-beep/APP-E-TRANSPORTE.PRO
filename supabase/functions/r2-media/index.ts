/**
 * Serve objectos públicos já copiados para o R2 (espelho/).
 * GET /r2-media/espelho/{bucket}/{...path}
 */
import { PUBLIC_STORAGE_BUCKETS, r2Client, r2Get } from "../_shared/r2.ts";

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

  let r2;
  try {
    r2 = r2Client();
  } catch {
    return new Response("R2 não configurado", { status: 503, headers: corsHeaders });
  }

  const res = await r2Get(r2, key);
  if (!res.ok) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  const ct = res.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  headers.set("Cache-Control", "public, max-age=86400, immutable");
  if (req.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(res.body, { status: 200, headers });
});
