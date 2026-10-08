import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 45;
const hitMap = new Map<string, { n: number; reset: number }>();

function rateOk(ip: string): boolean {
  const now = Date.now();
  const cur = hitMap.get(ip);
  if (!cur || now > cur.reset) {
    hitMap.set(ip, { n: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (cur.n >= MAX_PER_WINDOW) return false;
  cur.n += 1;
  return true;
}

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function ipPrefix(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  if (ip.includes(":")) {
    const p = ip.split(":");
    if (p.length >= 4) return `${p.slice(0, 4).join(":")}::/64`;
    return null;
  }
  const oct = ip.split(".");
  if (oct.length === 4) return `${oct[0]}.${oct[1]}.${oct[2]}.x`;
  return null;
}

function uaShort(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  return ua.length > 160 ? `${ua.slice(0, 157)}...` : ua;
}

function jwtRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function presentedTokens(req: Request): string[] {
  const out: string[] = [];
  const apikey = req.headers.get("apikey")?.trim();
  if (apikey) out.push(apikey);
  const m = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  const bearer = m?.[1]?.trim();
  if (bearer) out.push(bearer);
  return out;
}

function gatewayMatchesAnon(req: Request, anon: string): boolean {
  const tokens = presentedTokens(req);
  if (tokens.length === 0) return false;
  if (tokens.some((token) => token === anon)) return true;
  // Depois de rotacionar a chave, a env da função pode divergir da chave do app.
  // O gateway já aceitou a chave do projeto; aqui só confirmamos que é a chave anon.
  return tokens.some((token) => jwtRole(token) === "anon");
}

const FP_RE = /^[a-f0-9]{64}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "Configuração em falta" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!gatewayMatchesAnon(req, anonKey)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = clientIp(req);
  if (!rateOk(ip)) {
    return new Response(JSON.stringify({ error: "Demasiados pedidos" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const outcome = String(body.outcome ?? "failure");
  const fp = String(body.email_fingerprint ?? body.emailFingerprint ?? "").trim().toLowerCase();
  if (outcome !== "failure" || !FP_RE.test(fp)) {
    return new Response(JSON.stringify({ ok: false, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin.from("auth_login_failure_events").insert({
    outcome: "failure",
    email_fingerprint: fp,
    ip_prefix: ipPrefix(ip),
    user_agent_short: uaShort(req),
  });

  if (error) {
    console.error("log-auth-login-failure insert:", error.message);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
