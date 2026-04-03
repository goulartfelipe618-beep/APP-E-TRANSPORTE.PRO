import { corsHeaders, getAuthorizedUserAndCreds, instanceNameForUser } from "../_shared/evolutionMotorista.ts";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, apiKey } = auth;
    const instanceName = instanceNameForUser(user.id);
    const root = baseUrl.replace(/\/+$/, "");

    const delRes = await fetch(`${root}/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
      headers: { apikey: apiKey },
    });
    const delText = await delRes.text();

    if (!delRes.ok && delRes.status !== 404) {
      return new Response(
        JSON.stringify({
          error: `Evolution não excluiu a instância (${delRes.status}).`,
          detail: delText.slice(0, 400),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        instanceName,
        evolutionStatus: delRes.status,
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
