/** Compartilhado entre evolution-motorista-qr | sync | delete */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function assertSafeHttpsBase(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "https:") {
    throw new Error("Apenas HTTPS é permitido");
  }
  const h = u.hostname;
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.endsWith(".local")
  ) {
    throw new Error("Host não permitido");
  }
  return `${u.protocol}//${u.host}`;
}

export function instanceNameForUser(userId: string): string {
  return `etp-u-${userId.replace(/-/g, "").slice(0, 16)}`;
}

export async function getAuthorizedUserAndCreds(
  authHeader: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<
  | { ok: true; user: { id: string }; baseUrl: string; apiKey: string; supabaseAdmin: SupabaseClient }
  | { ok: false; status: number; body: string }
> {
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return { ok: false, status: 401, body: JSON.stringify({ error: "Sessão inválida" }) };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    return { ok: false, status: 500, body: JSON.stringify({ error: "Não foi possível verificar permissões." }) };
  }

  const allowed = (roleRows || []).some(
    (r: { role: string }) => r.role === "admin_transfer" || r.role === "admin_master",
  );
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      body: JSON.stringify({
        error: "Apenas motorista executivo ou administrador pode usar esta ação.",
      }),
    };
  }

  const { data: sistemaRow } = await supabaseAdmin
    .from("comunicadores_evolution")
    .select("id")
    .eq("escopo", "sistema")
    .maybeSingle();

  if (!sistemaRow?.id) {
    return { ok: false, status: 500, body: JSON.stringify({ error: "Comunicador oficial não encontrado." }) };
  }

  const { data: credsRow } = await supabaseAdmin
    .from("comunicador_evolution_credenciais")
    .select("api_url, api_key")
    .eq("comunicador_id", sistemaRow.id)
    .maybeSingle();

  const rawUrl = credsRow?.api_url?.trim() || "";
  const rawKey = credsRow?.api_key?.trim() || "";
  if (!rawUrl || !rawKey) {
    return {
      ok: false,
      status: 400,
      body: JSON.stringify({
        error: "Evolution API não configurada pelo administrador.",
        code: "missing_evolution_creds",
      }),
    };
  }

  let baseUrl: string;
  try {
    baseUrl = assertSafeHttpsBase(rawUrl);
  } catch (e) {
    return {
      ok: false,
      status: 400,
      body: JSON.stringify({ error: e instanceof Error ? e.message : "URL inválida" }),
    };
  }

  return { ok: true, user, baseUrl, apiKey: rawKey, supabaseAdmin };
}

export function parsePhoneFromJid(jid: string | undefined | null): string | null {
  if (!jid || typeof jid !== "string") return null;
  const digits = jid.split("@")[0]?.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  return digits;
}

export function extractPhoneDeep(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const keys = ["phoneNumber", "phone", "number", "owner", "jid", "ownerJid", "wuid"];
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string") {
        const p = parsePhoneFromJid(v.includes("@") ? v : `${v}@s.whatsapp.net`);
        if (p) return p;
        if (/^\d{10,15}$/.test(v.replace(/\D/g, ""))) return v.replace(/\D/g, "");
      }
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

export function extractProfileFromInstances(
  parsed: unknown,
  instanceName: string,
): { profilePicUrl: string | null; profileName: string | null; phone: string | null; state: string | null } {
  let profilePicUrl: string | null = null;
  let profileName: string | null = null;
  let phone: string | null = null;
  let state: string | null = null;

  const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  for (const item of arr) {
    const instWrap = item && typeof item === "object" && "instance" in (item as object)
      ? (item as { instance?: unknown }).instance
      : item;
    if (!instWrap || typeof instWrap !== "object") continue;
    const o = instWrap as Record<string, unknown>;
    const name = o.instanceName as string | undefined;
    if (name !== instanceName) continue;

    state = typeof o.state === "string" ? o.state : state;
    phone = extractPhoneDeep(o) ?? phone;

    const pic =
      (typeof o.profilePicUrl === "string" && o.profilePicUrl) ||
      (typeof o.profilePictureUrl === "string" && o.profilePictureUrl) ||
      (typeof (o as { picture?: string }).picture === "string" && (o as { picture: string }).picture) ||
      null;
    if (pic) profilePicUrl = pic;

    const nm =
      (typeof o.profileName === "string" && o.profileName) ||
      (typeof o.name === "string" && o.name) ||
      (typeof o.pushName === "string" && o.pushName) ||
      null;
    if (nm) profileName = nm;
  }

  return { profilePicUrl, profileName, phone, state };
}
