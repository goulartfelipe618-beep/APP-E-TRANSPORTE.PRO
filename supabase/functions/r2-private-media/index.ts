/**
 * Serve documentos privados no R2 (não usar r2-media público).
 * POST + Bearer → { url } com query assinada.
 * GET ?b=&p=&exp=&sig= → ficheiro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PRIVATE_STORAGE_BUCKETS, espelhoKey, r2Client, r2Get } from "../_shared/r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64urlFromBytes(buf: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlFromBytes(sig);
}

function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function normalizePath(raw: string): string | null {
  const t = raw.trim().replace(/^\/+/, "");
  if (!t || t.includes("..")) return null;
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const signSecret = (Deno.env.get("R2_PRIVATE_MEDIA_SECRET") ?? serviceKey).trim();
  if (!supabaseUrl || !anon || !serviceKey || signSecret.length < 16) {
    return json({ error: "Servidor não configurado." }, 500);
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const bucket = (url.searchParams.get("b") || "").trim();
    const path = normalizePath(url.searchParams.get("p") || "");
    const exp = Number(url.searchParams.get("exp") || "0");
    const sig = (url.searchParams.get("sig") || "").trim();
    if (!PRIVATE_STORAGE_BUCKETS.has(bucket) || !path || !sig || !Number.isFinite(exp)) {
      return json({ error: "Pedido inválido." }, 400);
    }
    if (exp < Math.floor(Date.now() / 1000)) return json({ error: "Expirado." }, 401);
    const expected = await hmac(signSecret, `${bucket}\n${path}\n${exp}`);
    if (expected.length !== sig.length) return json({ error: "Assinatura inválida." }, 401);
    let ok = true;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] !== sig[i]) ok = false;
    }
    if (!ok) return json({ error: "Assinatura inválida." }, 401);

    let r2;
    try {
      r2 = r2Client();
    } catch {
      return json({ error: "R2 não configurado." }, 503);
    }
    const res = await r2Get(r2, espelhoKey(bucket, path));
    if (!res.ok) return json({ error: "Ficheiro indisponível." }, 404);
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", res.headers.get("content-type") || contentTypeForPath(path));
    headers.set("Cache-Control", "private, max-age=300");
    return new Response(res.body, { status: 200, headers });
  }

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Sessão inválida." }, 401);

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  const uid = userData.user?.id;
  if (userErr || !uid) return json({ error: "Sessão inválida." }, 401);

  let body: { bucket?: unknown; path?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const bucket = String(body.bucket ?? "").trim();
  const path = normalizePath(String(body.path ?? ""));
  if (!PRIVATE_STORAGE_BUCKETS.has(bucket) || !path) {
    return json({ error: "bucket/path inválidos." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: staff } = await admin.rpc("is_platform_staff", { check_uid: uid });
  const owner = path.split("/")[0] ?? "";
  let canAccess = staff === true || uid === owner;
  if (!canAccess && bucket === "motorista-frota-docs") {
    const motoristaId = path.split("/")[1] ?? "";
    if (UUID_RE.test(motoristaId)) {
      const { data: sm } = await admin
        .from("solicitacoes_motoristas")
        .select("id")
        .eq("id", motoristaId)
        .eq("portal_auth_user_id", uid)
        .eq("status", "cadastrado")
        .maybeSingle();
      if (sm) canAccess = true;
    }
  }
  if (!canAccess) return json({ error: "Sem permissão." }, 403);

  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sig = await hmac(signSecret, `${bucket}\n${path}\n${exp}`);
  const mediaUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/r2-private-media?b=${encodeURIComponent(bucket)}&p=${encodeURIComponent(path)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
  return json({ ok: true, url: mediaUrl });
});
