import {
  corsHeaders,
  getAuthorizedUserAndCreds,
  loadStoredInstanceToken,
  parseUazapiTarget,
} from "../_shared/evolutionMotorista.ts";
import { uazapiDeleteInstance, uazapiRoot } from "../_shared/uazapi.ts";

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
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, supabaseAdmin, instanceName } = auth;
    const token = await loadStoredInstanceToken(supabaseAdmin, target, user.id);
    let delStatus = 404;
    if (token) {
      const del = await uazapiDeleteInstance(uazapiRoot(baseUrl), token);
      delStatus = del.status;
      if (!del.status.toString().startsWith("2") && del.status !== 404) {
        return new Response(
          JSON.stringify({
            error: `UAZAPI não excluiu a instância (${del.status}).`,
            detail: del.text.slice(0, 400),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (target === "own") {
      await supabaseAdmin
        .from("comunicadores_evolution")
        .update({
          uazapi_instance_token: null,
          qr_code_base64: null,
          connection_status: "desconectado",
          telefone_conectado: null,
          updated_at: new Date().toISOString(),
        })
        .eq("escopo", "usuario")
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin
        .from("comunicadores_evolution")
        .update({
          uazapi_instance_token: null,
          qr_code_base64: null,
          connection_status: "desconectado",
          telefone_conectado: null,
          updated_at: new Date().toISOString(),
        })
        .eq("escopo", "sistema");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        instanceName,
        evolutionStatus: delStatus,
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
