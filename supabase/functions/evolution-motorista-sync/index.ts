import {
  corsHeaders,
  extractPhoneDeep,
  getAuthorizedUserAndCreds,
  loadStoredInstanceToken,
  parseUazapiTarget,
  persistUazapiInstanceToken,
} from "../_shared/evolutionMotorista.ts";
import {
  extractUazapiQrBase64,
  extractUazapiStatus,
  isUazapiConnected,
  uazapiRoot,
  uazapiStatus,
} from "../_shared/uazapi.ts";

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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const target = parseUazapiTarget(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey, target);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, supabaseAdmin, instanceName } = auth;
    const token = await loadStoredInstanceToken(supabaseAdmin, target, user.id);
    if (!token) {
      return new Response(
        JSON.stringify({
          instanceName,
          phone: null,
          state: "disconnected",
          profilePicUrl: null,
          profileName: null,
          connected: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const st = await uazapiStatus(uazapiRoot(baseUrl), token);
    const json = st.json;
    const status = extractUazapiStatus(json);
    const phone = extractPhoneDeep(json);
    let profilePicUrl: string | null = null;
    let profileName: string | null = null;
    if (json && typeof json === "object") {
      const o = json as Record<string, unknown>;
      if (typeof o.profilePicUrl === "string") profilePicUrl = o.profilePicUrl;
      if (typeof o.profileName === "string") profileName = o.profileName;
    }
    const connected = isUazapiConnected(status) || Boolean(phone);
    const qr = extractUazapiQrBase64(json);

    if (connected) {
      await persistUazapiInstanceToken(supabaseAdmin, {
        target,
        userId: user.id,
        instanceName,
        token,
        extra: {
          connection_status: "conectado",
          telefone_conectado: phone,
          nome_dispositivo: profileName,
          foto_perfil_url: profilePicUrl,
          qr_code_base64: null,
        },
      });
    }

    return new Response(
      JSON.stringify({
        instanceName,
        phone,
        state: status,
        profilePicUrl,
        profileName,
        connected,
        qrcode: connected ? null : qr,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
