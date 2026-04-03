/**
 * Evolution API (WhatsApp) — URL e chave podem vir do painel (comunicador oficial)
 * ou, para testes, de VITE_EVOLUTION_API_URL / VITE_EVOLUTION_API_KEY.
 *
 * As chamadas usam a Edge Function `evolution-proxy` (servidor → Evolution) para evitar
 * 403 Forbidden que proxies costumam aplicar ao navegador.
 */

import { supabase } from "@/integrations/supabase/client";

export type EvolutionCreds = {
  baseUrl: string;
  apiKey: string;
};

/** Remove barras finais e evita // entre host e path (ex.: https://evo.com/ + /instance → sem //) */
export function normalizeBase(url: string): string {
  let u = url.trim();
  while (u.endsWith("/")) {
    u = u.slice(0, -1);
  }
  return u;
}

function envBase(): string | undefined {
  const b = import.meta.env.VITE_EVOLUTION_API_URL as string | undefined;
  return b ? normalizeBase(b) : undefined;
}

function envKey(): string | undefined {
  return import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined;
}

/** Remove espaços invisíveis e quebras de linha coladas ao copiar a API Key */
export function sanitizeApiKey(key: string): string {
  return key
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r?\n/g, "");
}

/** Resolve credenciais: prioridade para as passadas (painel); senão .env */
export function resolveEvolutionCreds(override?: EvolutionCreds | null): EvolutionCreds | null {
  if (override?.baseUrl?.trim() && override?.apiKey?.trim()) {
    return { baseUrl: normalizeBase(override.baseUrl), apiKey: sanitizeApiKey(override.apiKey) };
  }
  const b = envBase();
  const k = envKey();
  if (b && k) return { baseUrl: b, apiKey: sanitizeApiKey(k) };
  return null;
}

export function evolutionEnvConfigured(override?: EvolutionCreds | null): boolean {
  return resolveEvolutionCreds(override) !== null;
}

async function evolutionHttp(
  creds: EvolutionCreds,
  path: string,
  opts: { method: "GET" | "POST"; jsonBody?: unknown },
): Promise<{ status: number; bodyText: string }> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const { data, error } = await supabase.functions.invoke("evolution-proxy", {
    body: {
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      path: p,
      method: opts.method,
      jsonBody: opts.method === "POST" ? opts.jsonBody ?? null : undefined,
    },
  });
  if (error) {
    throw new Error(
      error.message ||
        "Deploy da função: supabase functions deploy evolution-proxy",
    );
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: string }).error));
  }
  const pack = data as { status: number; bodyText: string };
  if (typeof pack?.status !== "number" || typeof pack?.bodyText !== "string") {
    throw new Error("Resposta inválida do evolution-proxy");
  }
  return pack;
}

/** Extrai número exibível a partir de JID ou string só dígitos */
export function parseWhatsappPhoneFromJid(jid: string | undefined | null): string | null {
  if (!jid || typeof jid !== "string") return null;
  const digits = jid.split("@")[0]?.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  return digits;
}

/** Varre objeto JSON da Evolution em busca de telefone / JID */
function extractPhoneFromUnknown(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  const keys = [
    "phoneNumber",
    "phone",
    "number",
    "owner",
    "jid",
    "jidNormalized",
    "wuid",
    "ownerJid",
  ];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string") {
        const p = parseWhatsappPhoneFromJid(v.includes("@") ? v : `${v}@s.whatsapp.net`);
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

/** Lista instâncias e tenta achar telefone/estado pelo nome */
async function fetchPhoneFromInstancesList(
  creds: EvolutionCreds,
  instanceName: string,
): Promise<{ phone: string | null; state: string | null }> {
  try {
    const { status, bodyText } = await evolutionHttp(creds, "/instance/fetchInstances", { method: "GET" });
    if (status < 200 || status >= 300) return { phone: null, state: null };
    const list = JSON.parse(bodyText) as unknown;
    const arr = Array.isArray(list) ? list : [list];
    let phone: string | null = null;
    let state: string | null = null;
    for (const item of arr) {
      const o =
        item && typeof item === "object" && "instance" in (item as object)
          ? (item as { instance?: unknown }).instance
          : item;
      if (o && typeof o === "object") {
        const name = (o as { instanceName?: string }).instanceName;
        if (name === instanceName) {
          phone = extractPhoneFromUnknown(o) ?? phone;
          state = extractState(o) ?? state;
        }
      }
      phone = phone ?? extractPhoneFromUnknown(item);
    }
    return { phone, state };
  } catch {
    return { phone: null, state: null };
  }
}

/** Tenta criar instância e retorna QR em base64 */
/**
 * Cria/recupera instância na Evolution do administrador e retorna o QR (Edge Function).
 * Usa credenciais em `comunicador_evolution_credenciais` — não exige VITE_* no front do motorista.
 */
export async function fetchEvolutionMotoristaQrFromServer(): Promise<{
  base64: string | null;
  instanceName?: string;
  detail?: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    base64?: string;
    instanceName?: string;
    error?: string;
    detail?: string;
    code?: string;
  }>("evolution-motorista-qr", { body: {} });

  if (error) {
    return { base64: null, detail: error.message };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { base64: null, detail: (data.detail as string) || String(data.error) };
  }
  if (!data?.base64) {
    return { base64: null, detail: "Resposta sem QR Code." };
  }
  return { base64: data.base64, instanceName: data.instanceName };
}

/** Sincroniza número, foto e nome do perfil a partir da Evolution (Edge Function). */
export async function fetchEvolutionMotoristaSyncFromServer(): Promise<{
  phone: string | null;
  profilePicUrl: string | null;
  profileName: string | null;
  state: string | null;
  connected: boolean;
  detail?: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    phone?: string | null;
    profilePicUrl?: string | null;
    profileName?: string | null;
    state?: string | null;
    connected?: boolean;
    error?: string;
  }>("evolution-motorista-sync", { body: {} });

  if (error) {
    return { phone: null, profilePicUrl: null, profileName: null, state: null, connected: false, detail: error.message };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return {
      phone: null,
      profilePicUrl: null,
      profileName: null,
      state: null,
      connected: false,
      detail: String(data.error),
    };
  }
  if (!data) {
    return { phone: null, profilePicUrl: null, profileName: null, state: null, connected: false, detail: "Resposta vazia" };
  }
  return {
    phone: data.phone ?? null,
    profilePicUrl: data.profilePicUrl ?? null,
    profileName: data.profileName ?? null,
    state: data.state ?? null,
    connected: Boolean(data.connected),
  };
}

/** Remove a instância na Evolution do motorista (Edge Function). */
export async function fetchEvolutionMotoristaDeleteFromServer(): Promise<{ ok: boolean; detail?: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string; detail?: string }>(
    "evolution-motorista-delete",
    { body: {} },
  );

  if (error) {
    return { ok: false, detail: error.message };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { ok: false, detail: (data as { detail?: string }).detail || String((data as { error: string }).error) };
  }
  if (data && typeof data === "object" && (data as { ok?: boolean }).ok) {
    return { ok: true };
  }
  return { ok: false, detail: "Resposta inesperada" };
}

export async function fetchEvolutionQrCode(
  instanceName: string,
  creds?: EvolutionCreds | null,
): Promise<{
  base64: string | null;
  error?: "missing_env" | "http" | "parse";
  detail?: string;
}> {
  const c = resolveEvolutionCreds(creds ?? undefined);
  if (!c) {
    return { base64: null, error: "missing_env" };
  }

  try {
    const createPack = await evolutionHttp(c, "/instance/create", {
      method: "POST",
      jsonBody: {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      },
    });
    if (![200, 201, 409].includes(createPack.status)) {
      return { base64: null, error: "http", detail: `${createPack.status}: ${createPack.bodyText.slice(0, 200)}` };
    }

    const connectPack = await evolutionHttp(c, `/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET",
    });

    if (connectPack.status < 200 || connectPack.status >= 300) {
      return { base64: null, error: "http", detail: connectPack.bodyText.slice(0, 240) };
    }

    const data = JSON.parse(connectPack.bodyText) as Record<string, unknown>;
    const b64 =
      (typeof data.base64 === "string" && data.base64) ||
      (typeof (data as { qrcode?: { base64?: string } }).qrcode?.base64 === "string" &&
        (data as { qrcode: { base64: string } }).qrcode.base64) ||
      null;

    return { base64: b64 };
  } catch (e) {
    return { base64: null, error: "parse", detail: e instanceof Error ? e.message : String(e) };
  }
}

export type EnsureInstanceResult = {
  phone: string | null;
  state: string | null;
  /** Status HTTP do POST /instance/create (útil para diagnosticar 401) */
  createHttpStatus?: number;
  /** Mensagem curta se create falhou */
  createErrorHint?: string;
};

/**
 * Registra a instância na Evolution sem solicitar QR no fluxo (qrcode: false)
 * e consulta o estado várias vezes até obter número ou esgotar tentativas.
 */
export async function ensureInstanceAndPollConnection(
  instanceName: string,
  creds: EvolutionCreds,
  opts?: { pollAttempts?: number; pollMs?: number; nomeDispositivo?: string | null },
): Promise<EnsureInstanceResult> {
  const c = resolveEvolutionCreds(creds);
  if (!c) {
    return { phone: null, state: null, createErrorHint: "Credenciais inválidas." };
  }

  const pollAttempts = opts?.pollAttempts ?? 10;
  const pollMs = opts?.pollMs ?? 2000;

  let createHttpStatus: number | undefined;
  let createErrorHint: string | undefined;

  try {
    const body: Record<string, unknown> = {
      instanceName,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    };
    const nd = opts?.nomeDispositivo?.trim();
    if (nd) {
      body.deviceName = nd;
    }
    const createPack = await evolutionHttp(c, "/instance/create", {
      method: "POST",
      jsonBody: body,
    });
    createHttpStatus = createPack.status;
    if (![200, 201, 409].includes(createPack.status)) {
      const t = createPack.bodyText;
      if (createPack.status === 401) {
        createErrorHint =
          "401: a Evolution recusou a API Key. Confira AUTHENTICATION_API_KEY no .env da Evolution e o mesmo valor no painel.";
      } else if (createPack.status === 403) {
        createErrorHint =
          "403: a Evolution recusou a requisição. Com a função evolution-proxy no Supabase o tráfego sai do servidor; se persistir, verifique firewall/API Key no servidor Evolution.";
      } else {
        createErrorHint = `${createPack.status}: ${t.slice(0, 160)}`;
      }
    }
  } catch (e) {
    createErrorHint = e instanceof Error ? e.message : String(e);
  }

  for (let i = 0; i < pollAttempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, pollMs));
    }
    const { phone, state } = await fetchEvolutionConnectionInfo(instanceName, c);
    if (phone) {
      return { phone, state, createHttpStatus, createErrorHint };
    }
    if (state === "open") {
      const again = await fetchEvolutionConnectionInfo(instanceName, c);
      if (again.phone) {
        return { phone: again.phone, state: again.state, createHttpStatus, createErrorHint };
      }
    }
  }

  const last = await fetchEvolutionConnectionInfo(instanceName, c);
  return { ...last, createHttpStatus, createErrorHint };
}

/** Estado da conexão e número (quando conectado) */
export async function fetchEvolutionConnectionInfo(
  instanceName: string,
  creds?: EvolutionCreds | null,
): Promise<{
  phone: string | null;
  state: string | null;
  detail?: string;
}> {
  const c = resolveEvolutionCreds(creds ?? undefined);
  if (!c) {
    return { phone: null, state: null, detail: "missing_creds" };
  }

  try {
    const pack = await evolutionHttp(c, `/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
    });
    const text = pack.bodyText;
    const status = pack.status;
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (status === 404) {
        return fetchPhoneFromInstancesList(c, instanceName);
      }
      return { phone: null, state: null, detail: text.slice(0, 200) };
    }

    let phone = extractPhoneFromUnknown(data);
    let state = extractState(data);

    if (!phone && status >= 200 && status < 300) {
      const fromList = await fetchPhoneFromInstancesList(c, instanceName);
      phone = phone ?? fromList.phone;
      state = state ?? fromList.state;
    }

    if (!phone && (status === 404 || status < 200 || status >= 300)) {
      const fromList = await fetchPhoneFromInstancesList(c, instanceName);
      phone = fromList.phone;
      state = fromList.state ?? state;
    }

    return { phone, state };
  } catch (e) {
    return {
      phone: null,
      state: null,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Formata número BR para exibição */
export function formatPhoneBrDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    const rest = d.slice(2);
    if (rest.length === 11) {
      return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
    }
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return digits;
}
