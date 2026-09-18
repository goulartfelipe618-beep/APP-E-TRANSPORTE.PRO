/** Compartilhado entre evolution-motorista-qr | sync | delete | uazapi-send-card */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractUazapiName,
  extractUazapiToken,
  findInstanceInAllList,
  uazapiInitInstance,
  uazapiListInstances,
  uazapiRoot,
  uazapiStatus,
} from "./uazapi.ts";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const INSTANCE_SISTEMA_DEFAULT = "etp-sistema-oficial";

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

const MOTORISTA_OWN_ROLES = new Set(["admin_transfer", "motorista_executivo", "admin_master"]);
const SISTEMA_ROLES = new Set(["admin_master"]);

export function hasMotoristaEvolutionInstanceRole(roleRows: Array<{ role: string }>): boolean {
  return roleRows.some((r) => MOTORISTA_OWN_ROLES.has(r.role));
}

export type UazapiTarget = "own" | "sistema";

export function parseUazapiTarget(body: unknown): UazapiTarget {
  if (body && typeof body === "object" && (body as { target?: unknown }).target === "sistema") {
    return "sistema";
  }
  return "own";
}

export type AuthCredsOk = {
  ok: true;
  user: { id: string };
  baseUrl: string;
  apiKey: string;
  supabaseAdmin: SupabaseClient;
  target: UazapiTarget;
  instanceName: string;
  roles: string[];
};

export async function getAuthorizedUserAndCreds(
  authHeader: string,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  target: UazapiTarget = "own",
): Promise<AuthCredsOk | { ok: false; status: number; body: string }> {
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

  const roles = (roleRows || []).map((r) => r.role);
  if (target === "sistema") {
    if (!roles.some((r) => SISTEMA_ROLES.has(r))) {
      return {
        ok: false,
        status: 403,
        body: JSON.stringify({
          error: "Apenas o administrador master pode gerir a instância oficial uazapi.",
          code: "uazapi_sistema_role_only",
        }),
      };
    }
  } else if (!roles.some((r) => MOTORISTA_OWN_ROLES.has(r))) {
    return {
      ok: false,
      status: 403,
      body: JSON.stringify({
        error: "Acesso negado: WhatsApp próprio é só para conta de frota (Motorista Executivo).",
        code: "evolution_motorista_role_only",
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
        error: "UAZAPI não configurada pelo administrador (URL + Admin Token).",
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

  const instanceName = target === "sistema" ? INSTANCE_SISTEMA_DEFAULT : instanceNameForUser(user.id);

  return { ok: true, user, baseUrl, apiKey: rawKey, supabaseAdmin, target, instanceName, roles };
}

export async function loadStoredInstanceToken(
  supabaseAdmin: SupabaseClient,
  target: UazapiTarget,
  userId: string,
): Promise<string | null> {
  if (target === "sistema") {
    const full = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("id, uazapi_instance_token")
      .eq("escopo", "sistema")
      .maybeSingle();
    let sistemaId: string | null = (full.data as { id?: string } | null)?.id ?? null;
    let fromRow =
      (full.data as { uazapi_instance_token?: string | null } | null)?.uazapi_instance_token?.trim() || null;
    if (full.error) {
      const slim = await supabaseAdmin
        .from("comunicadores_evolution")
        .select("id")
        .eq("escopo", "sistema")
        .maybeSingle();
      sistemaId = slim.data?.id ?? null;
      fromRow = null;
    }
    if (fromRow) return fromRow;
    if (!sistemaId) return null;
    const { data: creds } = await supabaseAdmin
      .from("comunicador_evolution_credenciais")
      .select("api_key")
      .eq("comunicador_id", sistemaId)
      .maybeSingle();
    return creds?.api_key?.trim() || null;
  }
  const full = await supabaseAdmin
    .from("comunicadores_evolution")
    .select("uazapi_instance_token")
    .eq("escopo", "usuario")
    .eq("user_id", userId)
    .maybeSingle();
  if (!full.error) {
    return (full.data as { uazapi_instance_token?: string | null } | null)?.uazapi_instance_token?.trim() || null;
  }
  return null;
}

async function updateComunicadorPatch(
  supabaseAdmin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("comunicadores_evolution").update(patch).eq("id", id);
  if (!error) return;
  if (!String(error.message || "").includes("uazapi_instance_token")) {
    console.error(error.message);
    return;
  }
  const rest = { ...patch };
  delete rest.uazapi_instance_token;
  await supabaseAdmin.from("comunicadores_evolution").update(rest).eq("id", id);
}

export async function persistUazapiInstanceToken(
  supabaseAdmin: SupabaseClient,
  opts: {
    target: UazapiTarget;
    userId: string;
    instanceName: string;
    token: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    instance_name: opts.instanceName,
    uazapi_instance_token: opts.token,
    updated_at: new Date().toISOString(),
    ...(opts.extra || {}),
  };
  if (opts.target === "sistema") {
    const { data: existing } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("id")
      .eq("escopo", "sistema")
      .maybeSingle();
    if (existing?.id) {
      await updateComunicadorPatch(supabaseAdmin, existing.id, patch);
      await supabaseAdmin
        .from("comunicador_evolution_credenciais")
        .update({ api_key: opts.token, updated_at: new Date().toISOString() })
        .eq("comunicador_id", existing.id);
    }
    return;
  }
  const { data: existing } = await supabaseAdmin
    .from("comunicadores_evolution")
    .select("id")
    .eq("escopo", "usuario")
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (existing?.id) {
    await updateComunicadorPatch(supabaseAdmin, existing.id, patch);
    return;
  }
  const insertRow: Record<string, unknown> = {
    escopo: "usuario",
    user_id: opts.userId,
    rotulo: "WhatsApp do motorista",
    connection_status: "desconectado",
    ...patch,
  };
  const { error: insErr } = await supabaseAdmin.from("comunicadores_evolution").insert(insertRow);
  if (insErr && String(insErr.message || "").includes("uazapi_instance_token")) {
    delete insertRow.uazapi_instance_token;
    await supabaseAdmin.from("comunicadores_evolution").insert(insertRow);
  }
}

async function tokenWorksAsInstance(
  root: string,
  token: string | null | undefined,
): Promise<{ token: string; initJson: unknown } | null> {
  const t = token?.trim();
  if (!t) return null;
  const st = await uazapiStatus(root, t);
  if (st.status >= 200 && st.status < 300) {
    return { token: t, initJson: st.json };
  }
  return null;
}

/** Garante instância uazapi: token já gravado, token da plataforma, ou init admin. */
export async function ensureUazapiInstanceToken(
  root: string,
  adminToken: string,
  instanceName: string,
  storedToken: string | null,
): Promise<{ token: string; initJson: unknown; detail?: string }> {
  const storedOk = await tokenWorksAsInstance(root, storedToken);
  if (storedOk) return storedOk;

  const platformOk = await tokenWorksAsInstance(root, adminToken);
  if (platformOk) {
    return { ...platformOk, detail: "token da plataforma (instância)" };
  }

  const init = await uazapiInitInstance(root, adminToken, instanceName, "E-Transporte.pro");
  const fromInit = extractUazapiToken(init.json);
  if (fromInit) {
    return { token: fromInit, initJson: init.json };
  }

  const listed = await uazapiListInstances(root, adminToken);
  const hit = findInstanceInAllList(listed.json, instanceName);
  const fromList = extractUazapiToken(hit);
  if (fromList) {
    return { token: fromList, initJson: hit, detail: init.text.slice(0, 400) };
  }

  throw new Error(
    `Não foi possível criar/obter a instância uazapi (${init.status}): ${init.text.slice(0, 500)}`,
  );
}

/** Impede que um segundo utilizador reutilize o token único da plataforma. */
export async function assertPlatformInstanceAvailable(
  supabaseAdmin: SupabaseClient,
  token: string,
  userId: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("comunicadores_evolution")
    .select("escopo, user_id")
    .eq("uazapi_instance_token", token);
  const other = (data || []).find(
    (r) => r.escopo === "usuario" && typeof r.user_id === "string" && r.user_id !== userId,
  );
  if (other) {
    throw new Error(
      "A instância UAZAPI da plataforma já está em uso pelo primeiro utilizador que gerou o QR Code.",
    );
  }
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
    const name = (o.instanceName as string | undefined) || (o.name as string | undefined);
    if (name !== instanceName) continue;

    state = typeof o.state === "string" ? o.state : typeof o.status === "string" ? o.status : state;
    phone = extractPhoneDeep(o) ?? phone;

    const pic =
      (typeof o.profilePicUrl === "string" && o.profilePicUrl) ||
      (typeof o.profilePictureUrl === "string" && o.profilePictureUrl) ||
      (typeof (o as { picture?: string }).picture === "string" && (o as { picture: string }).picture) ||
      null;
    if (pic) profilePicUrl = pic;

    const nm =
      (typeof o.profileName === "string" && o.profileName) ||
      (typeof o.name === "string" && o.name !== instanceName && o.name) ||
      (typeof o.pushName === "string" && o.pushName) ||
      null;
    if (nm) profileName = nm;
  }

  return { profilePicUrl, profileName, phone, state };
}

export { extractUazapiName, uazapiRoot };
