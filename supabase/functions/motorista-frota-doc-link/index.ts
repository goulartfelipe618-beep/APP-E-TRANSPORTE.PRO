/**
 * Links de documentos da frota com JWT curto:
 * - POST + Bearer: valida acesso (dono do path ou admin_master), devolve tokens por path.
 * - GET ?t=jwt: serve o ficheiro (iframe/img); não expõe URL longa do Storage assinado no browser do utilizador.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMotoristaJwtSecret } from "../_shared/motoristaJwtSecret.ts";

const BUCKET = "motorista-frota-docs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeB64url(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return atob(s);
}

async function hmacSha256B64Url(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bin = String.fromCharCode(...new Uint8Array(sig));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlFromString(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwtHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64urlFromString(JSON.stringify(header));
  const p = b64urlFromString(JSON.stringify(payload));
  const sig = await hmacSha256B64Url(secret, `${h}.${p}`);
  return `${h}.${p}.${sig}`;
}

async function verifyDocJwt(
  token: string,
  secret: string,
): Promise<{ p: string; sub: string; exp: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  const expected = await hmacSha256B64Url(secret, `${h}.${p}`);
  if (expected.length !== s.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== s[i]) ok = false;
  }
  if (!ok) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decodeB64url(p));
  } catch {
    return null;
  }
  if (String(payload.typ || "") !== "mfd1") return null;
  const path = String(payload.p || "").trim();
  const sub = String(payload.sub || "").trim();
  const exp = Number(payload.exp);
  if (!path || !UUID_RE.test(sub) || !Number.isFinite(exp)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) return null;
  return { p: path, sub, exp };
}

function normalizePath(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.includes("..")) return null;
  const parts = t.split("/").filter(Boolean);
  if (parts.length < 3) return null;
  if (!UUID_RE.test(parts[0]!) || !UUID_RE.test(parts[1]!)) return null;
  return parts.join("/");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = await resolveMotoristaJwtSecret();
  if (secret.length < 16) {
    return new Response(
      JSON.stringify({
        error: "Secret JWT indisponível nas Edge Functions.",
        code: "missing_jwt_secret",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") || "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token em falta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const claims = await verifyDocJwt(token, secret);
    if (!claims) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(claims.p);
    if (dlErr || !blob) {
      return new Response(JSON.stringify({ error: "Ficheiro indisponível" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const buf = await blob.arrayBuffer();
    const ct = blob.type && blob.type.length > 0 ? blob.type : contentTypeForPath(claims.p);
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": ct,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawPaths = Array.isArray(body.paths) ? body.paths : [];
  const paths = [...new Set(rawPaths.map((p) => normalizePath(String(p))))].filter((p): p is string =>
    Boolean(p)
  ).slice(0, 24);

  if (paths.length === 0) {
    return new Response(JSON.stringify({ tokens: {} }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isMaster } = await admin.rpc("is_admin_master", { _user_id: user.id });

  const tokens: Record<string, string> = {};
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  for (const path of paths) {
    const ownerId = path.split("/")[0]!;
    let canAccess = user.id === ownerId;
    if (!canAccess && isMaster === true) {
      canAccess = true;
    }
    if (!canAccess) continue;

    let ok = false;
    if (user.id === ownerId) {
      const { error } = await supabaseUser.storage.from(BUCKET).download(path);
      ok = !error;
    } else if (isMaster === true) {
      const { error } = await admin.storage.from(BUCKET).download(path);
      ok = !error;
    }
    if (!ok) continue;

    const jwt = await signJwtHS256(
      { typ: "mfd1", p: path, sub: user.id, iat: now, exp },
      secret,
    );
    tokens[path] = jwt;
  }

  return new Response(JSON.stringify({ tokens }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
