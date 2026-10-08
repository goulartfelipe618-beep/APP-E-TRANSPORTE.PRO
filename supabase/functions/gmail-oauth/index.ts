import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = "openid email https://www.googleapis.com/auth/gmail.readonly";
const FALLBACK_RETURN = "https://business.transporteexecutivo.com/dashboard";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirect(target: string) {
  return new Response(null, { status: 302, headers: { Location: target } });
}

function service(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() ?? "";
}

function safeReturnTo(raw: unknown): string | null {
  try {
    const url = new URL(String(raw ?? ""));
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1";
    const allowed =
      local ||
      host === "e-transporte.pro" ||
      host.endsWith(".e-transporte.pro") ||
      host.endsWith(".transporteexecutivo.com");
    if (!allowed) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    return `${url.origin}/dashboard`;
  } catch {
    return null;
  }
}

function withGmailQuery(returnTo: string, result: "conectado" | "erro"): string {
  const url = new URL(returnTo);
  url.searchParams.set("gmail", result);
  return url.toString();
}

async function secret(sb: SupabaseClient, key: string): Promise<string> {
  const fromEnv = Deno.env.get(key)?.trim();
  if (fromEnv) return fromEnv;
  const { data } = await sb.from("app_internal_secrets").select("value").eq("key", key).maybeSingle();
  return String(data?.value ?? "").trim();
}

async function operatorId(sb: SupabaseClient, jwt: string): Promise<string | null> {
  if (!jwt || jwt.split(".").length < 3) return null;
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin_transfer", "admin_master"])
    .limit(1)
    .maybeSingle();
  return role ? data.user.id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = service();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const { data: pending } = await sb
      .from("gmail_oauth_states")
      .select("user_id, return_to, created_at")
      .eq("state", state)
      .maybeSingle();
    const returnTo = safeReturnTo(pending?.return_to) ?? FALLBACK_RETURN;
    await sb.from("gmail_oauth_states").delete().eq("state", state);

    const fresh =
      pending?.created_at && Date.now() - new Date(pending.created_at).getTime() < 15 * 60 * 1000;
    if (!pending || !fresh || !code || url.searchParams.get("error")) {
      return redirect(withGmailQuery(returnTo, "erro"));
    }

    const clientId = await secret(sb, "GOOGLE_GMAIL_CLIENT_ID");
    const clientSecret = await secret(sb, "GOOGLE_GMAIL_CLIENT_SECRET");
    if (!clientId || !clientSecret) return redirect(withGmailQuery(returnTo, "erro"));

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-oauth`,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenRes.json().catch(() => ({}));
    const access = String(token.access_token ?? "");
    if (!tokenRes.ok || !access) return redirect(withGmailQuery(returnTo, "erro"));

    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${access}` },
    });
    const profile = await profileRes.json().catch(() => ({}));
    const email = String(profile.emailAddress ?? "").trim();
    if (!profileRes.ok || !email) return redirect(withGmailQuery(returnTo, "erro"));

    const { data: existing } = await sb
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", pending.user_id)
      .maybeSingle();
    const refresh = String(token.refresh_token ?? existing?.refresh_token ?? "");
    if (!refresh) return redirect(withGmailQuery(returnTo, "erro"));

    const expiresIn = Number(token.expires_in);
    const { error } = await sb.from("gmail_connections").upsert({
      user_id: pending.user_id,
      email,
      refresh_token: refresh,
      access_token: access,
      access_token_expires_at: Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });
    if (error) return redirect(withGmailQuery(returnTo, "erro"));
    return redirect(withGmailQuery(returnTo, "conectado"));
  }

  if (req.method !== "POST") return json({ ok: false, error: "Metodo invalido" }, 405);

  const userId = await operatorId(sb, bearer(req));
  if (!userId) return json({ ok: false, error: "Nao autorizado" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "status");

  if (action === "status") {
    const { data } = await sb.from("gmail_connections").select("email").eq("user_id", userId).maybeSingle();
    return json({ ok: true, connected: Boolean(data?.email), email: data?.email ?? null });
  }

  if (action === "disconnect") {
    const { data } = await sb
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.refresh_token) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: data.refresh_token }),
      }).catch(() => undefined);
    }
    await sb.from("gmail_connections").delete().eq("user_id", userId);
    return json({ ok: true, connected: false, email: null });
  }

  if (action !== "start") return json({ ok: false, error: "Acao desconhecida" }, 400);

  const clientId = await secret(sb, "GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret = await secret(sb, "GOOGLE_GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return json({
      ok: false,
      error: "A conexao com o Gmail ainda nao foi liberada nesta plataforma.",
    });
  }

  const returnTo = safeReturnTo(body?.returnTo) ?? FALLBACK_RETURN;
  const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await sb.from("gmail_oauth_states").delete().lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const { error } = await sb.from("gmail_oauth_states").insert({ state, user_id: userId, return_to: returnTo });
  if (error) return json({ ok: false, error: "Nao foi possivel iniciar a conexao." }, 500);

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-oauth`);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", SCOPES);
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", state);
  auth.searchParams.set("include_granted_scopes", "true");
  return json({ ok: true, url: auth.toString() });
});
