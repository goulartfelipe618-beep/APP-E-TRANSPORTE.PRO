/** Auth helpers para Edge Functions Google Sheets backup. */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-google-sheets-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function envClients() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { supabaseUrl, anonKey, serviceKey };
}

export async function requireAdminTransfer(
  authHeader: string | null,
): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: Response }
> {
  if (!authHeader) {
    return { ok: false, response: json(401, { error: "Não autorizado" }) };
  }
  const { supabaseUrl, anonKey, serviceKey } = envClients();
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return { ok: false, response: json(401, { error: "Sessão inválida" }) };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    return { ok: false, response: json(500, { error: "Não foi possível verificar permissões." }) };
  }
  const list = (roles || []).map((r: { role: string }) => r.role);
  if (list.includes("admin_master")) {
    return {
      ok: false,
      response: json(403, {
        error: "Integração Google Sheets é para empresas (Motorista Executivo), não Admin Master.",
      }),
    };
  }
  if (!list.includes("admin_transfer")) {
    return {
      ok: false,
      response: json(403, { error: "Apenas empresas de transporte podem ligar o Google Sheets." }),
    };
  }
  return { ok: true, userId: user.id, admin };
}

export function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
