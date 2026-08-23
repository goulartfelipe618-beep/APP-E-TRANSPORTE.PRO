import { corsHeaders, json, requireAdminTransfer } from "../_shared/googleSheetsAuth.ts";
import { revokeGoogleToken } from "../_shared/googleSheets.ts";

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

    const { data: row } = await auth.admin
      .from("google_sheets_backup_connections")
      .select("refresh_token, access_token")
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (row?.refresh_token) await revokeGoogleToken(String(row.refresh_token));
    else if (row?.access_token) await revokeGoogleToken(String(row.access_token));

    const { error } = await auth.admin
      .from("google_sheets_backup_connections")
      .delete()
      .eq("user_id", auth.userId);

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
