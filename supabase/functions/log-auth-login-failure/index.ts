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

function gatewayMatchesAnon(req: Request, anon: string): boolean {
  const ak = req.headers.get("apikey");
  if (ak === anon) return true;
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] === anon;
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

  const outcome = String(body.outcome ?? "");
  const fp = String(body.email_fingerprint ?? body.emailFingerprint ?? "").trim().toLowerCase();
  if (outcome !== "failure" || !FP_RE.test(fp)) {
    return new Response(JSON.stringify({ error: "Payload inválido" }), {
      status: 400,
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
    return new Response(JSON.stringify({ error: "Falha ao registar" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
