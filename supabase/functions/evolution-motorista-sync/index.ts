import {
  corsHeaders,
  extractPhoneDeep,
  extractProfileFromInstances,
  getAuthorizedUserAndCreds,
  instanceNameForUser,
} from "../_shared/evolutionMotorista.ts";

function extractState(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const inst = o.instance;
  if (inst && typeof inst === "object") {
    const s = (inst as Record<string, unknown>).state;
    if (typeof s === "string") return s;
  }
  const s = o.state;
  if (typeof s === "string") return s;
  return null;
}

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

    let phone: string | null = null;
    let state: string | null = null;
    let profilePicUrl: string | null = null;
    let profileName: string | null = null;

    const csRes = await fetch(`${root}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: { apikey: apiKey },
    });
    const csText = await csRes.text();
    if (csRes.ok) {
      try {
        const csJson = JSON.parse(csText) as unknown;
        phone = extractPhoneDeep(csJson);
        state = extractState(csJson) ?? state;
        if (!phone) phone = extractPhoneDeep(csJson);
      } catch {
        /* ignore */
      }
    }

    const fiRes = await fetch(`${root}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: apiKey },
    });
    const fiText = await fiRes.text();
    if (fiRes.ok) {
      try {
        const fiJson = JSON.parse(fiText) as unknown;
        const prof = extractProfileFromInstances(fiJson, instanceName);
        profilePicUrl = prof.profilePicUrl;
        profileName = prof.profileName;
        phone = phone ?? prof.phone;
        state = state ?? prof.state;
      } catch {
        /* ignore */
      }
    }

    const connected =
      Boolean(phone) ||
      state === "open" ||
      (typeof state === "string" && state.toLowerCase().includes("connect"));

    return new Response(
      JSON.stringify({
        instanceName,
        phone,
        state,
        profilePicUrl,
        profileName,
        connected,
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
