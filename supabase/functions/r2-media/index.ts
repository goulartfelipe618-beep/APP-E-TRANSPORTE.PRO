/**
 * Imagens públicas. Com CDN, redireciona para o domínio público.
 * Sem CDN, entrega o ficheiro aqui: a URL assinada do R2 responde 403 no browser.
 */
import { PUBLIC_STORAGE_BUCKETS, publicObjectUrl, r2Client, r2ClientWith, r2Get } from "../_shared/r2.ts";

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
    r2 = await openR2();
  } catch {
    return new Response("R2 não configurado", { status: 503, headers: corsHeaders });
  }

  try {
    const upstream = await r2Get(r2, key);
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return new Response(req.method === "HEAD" ? null : "Not found", { status: 404, headers: corsHeaders });
    }
    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("content-type") || mimeFromKey(key),
      "Cache-Control": "public, max-age=86400",
    };
    const len = upstream.headers.get("content-length");
    if (len) headers["Content-Length"] = len;
    if (req.method === "HEAD") {
      await upstream.body?.cancel();
      return new Response(null, { status: 200, headers });
    }
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
});

let r2Ready: Promise<Awaited<ReturnType<typeof openR2Once>>> | null = null;

async function openR2() {
  if (!r2Ready) r2Ready = openR2Once().catch((err) => {
    r2Ready = null;
    throw err;
  });
  return r2Ready;
}

async function openR2Once() {
  try {
    return r2Client();
  } catch {
    /* Segredos do projeto podem não estar no ambiente da função. */
  }
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) throw new Error("R2 sem credenciais");
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_internal_secrets?key=in.(R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY)&select=key,value`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) throw new Error("R2 sem credenciais");
  const rows = (await res.json()) as { key?: string; value?: string }[];
  const access = rows.find((row) => row.key === "R2_ACCESS_KEY_ID")?.value ?? "";
  const secret = rows.find((row) => row.key === "R2_SECRET_ACCESS_KEY")?.value ?? "";
  return r2ClientWith(access, secret);
}

function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "ico") return "image/x-icon";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}
