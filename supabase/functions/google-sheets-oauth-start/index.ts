import { corsHeaders, json, requireAdminTransfer, randomState, envClients } from "../_shared/googleSheetsAuth.ts";
import { buildGoogleAuthUrl, getGoogleOAuthConfig } from "../_shared/googleSheets.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const auth = await requireAdminTransfer(req.headers.get("Authorization"));
    if (!auth.ok) return auth.response;

    getGoogleOAuthConfig();

    const state = randomState();
    const { serviceKey, supabaseUrl } = envClients();
    const admin = createClient(supabaseUrl, serviceKey);

    try {
      await admin.rpc("cleanup_google_sheets_oauth_states");
    } catch {
      /* opcional */
    }

    const { error: stErr } = await admin.from("google_sheets_oauth_states").insert({
      state,
      user_id: auth.userId,
    });
    if (stErr) {
      console.error(stErr);
      return json(500, { error: "Não foi possível iniciar OAuth." });
    }

    const authUrl = buildGoogleAuthUrl(state);
    return json(200, { authUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return json(500, { error: msg });
  }
});
