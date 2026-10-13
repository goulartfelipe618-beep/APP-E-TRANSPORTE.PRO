/** Sessão do CHAT. O token da instância fica no servidor e não volta na resposta. */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAPEIS = new Set(["admin_transfer", "motorista_executivo", "admin_master"]);

function baseHttps(url: string): string {
  const u = new URL(url.trim());
  if (u.protocol !== "https:") throw new Error("Apenas HTTPS é permitido");
  const h = u.hostname;
  if (h === "localhost" || h === "0.0.0.0" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") || h.endsWith(".local")) {
    throw new Error("Host não permitido");
  }
  return `${u.protocol}//${u.host}`;
}

async function tokenDaConta(admin: SupabaseClient, userId: string): Promise<string | null> {
  const full = await admin
    .from("comunicadores_evolution")
    .select("uazapi_instance_token")
    .eq("escopo", "usuario")
    .eq("user_id", userId)
    .maybeSingle();
  if (!full.error) {
    const own = (full.data as { uazapi_instance_token?: string | null } | null)?.uazapi_instance_token?.trim() || null;
    if (own) return own;
  }
  const assigned = await admin
    .from("comunicador_uazapi_instancias")
    .select("instance_token")
    .eq("assigned_user_id", userId)
    .maybeSingle();
  const token = String((assigned.data as { instance_token?: string } | null)?.instance_token || "").trim();
  return token || null;
}

type SessaoPronta = { userId: string; baseUrl: string; token: string; conectado: boolean };
const sessaoCache = new Map<string, { ate: number; sessao: SessaoPronta }>();
const SESSAO_MS = 3 * 60 * 1000;

async function chaveDaSessao(authHeader: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(authHeader));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessaoDoChat(
  authHeader: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<
  | { ok: true; userId: string; baseUrl: string; token: string; conectado: boolean; admin: SupabaseClient }
  | { ok: false; status: number; body: string }
> {
  const admin = createClient(supabaseUrl, serviceKey);
  const agora = Date.now();
  const chave = await chaveDaSessao(authHeader);
  const guardada = sessaoCache.get(chave);
  if (guardada && guardada.ate > agora) {
    return { ok: true, ...guardada.sessao, admin };
  }
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return { ok: false, status: 401, body: JSON.stringify({ error: "Sessão inválida" }) };
  }
  const { data: roleRows, error: roleErr } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (roleErr) {
    return { ok: false, status: 500, body: JSON.stringify({ error: "Não foi possível verificar permissões." }) };
  }
  const roles = (roleRows || []).map((r) => r.role);
  if (!roles.some((r) => PAPEIS.has(r))) {
    return {
      ok: false,
      status: 403,
      body: JSON.stringify({ error: "O chat usa o WhatsApp da conta de frota.", code: "evolution_motorista_role_only" }),
    };
  }
  const { data: conta } = await admin
    .from("comunicadores_evolution")
    .select("uazapi_instance_token, uazapi_server_url, connection_status, telefone_conectado")
    .eq("escopo", "usuario")
    .eq("user_id", user.id)
    .maybeSingle();
  const linha = conta as {
    uazapi_instance_token?: string | null;
    uazapi_server_url?: string | null;
    connection_status?: string | null;
    telefone_conectado?: string | null;
  } | null;
  let token = linha?.uazapi_instance_token?.trim() || "";
  if (!token) token = (await tokenDaConta(admin, user.id)) || "";
  let baseUrl: string;
  try {
    baseUrl = baseHttps(linha?.uazapi_server_url?.trim() || Deno.env.get("UAZAPI_SERVER_URL") || "https://ipazua.uazapi.com");
  } catch (e) {
    return { ok: false, status: 400, body: JSON.stringify({ error: e instanceof Error ? e.message : "URL inválida" }) };
  }
  const conectado = Boolean(token && (linha?.telefone_conectado?.trim() || /^(open|connected|conectado|online)$/i.test(String(linha?.connection_status || ""))));
  const sessao = { userId: user.id, baseUrl, token, conectado };
  sessaoCache.set(chave, { ate: agora + SESSAO_MS, sessao });
  return { ok: true, ...sessao, admin };
}
