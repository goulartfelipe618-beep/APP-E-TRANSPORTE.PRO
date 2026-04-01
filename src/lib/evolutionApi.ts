/**
 * Evolution API (WhatsApp) — URL e chave podem vir do painel (comunicador oficial)
 * ou, para testes, de VITE_EVOLUTION_API_URL / VITE_EVOLUTION_API_KEY.
 */

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

/** Resolve credenciais: prioridade para as passadas (painel); senão .env */
export function resolveEvolutionCreds(override?: EvolutionCreds | null): EvolutionCreds | null {
  if (override?.baseUrl?.trim() && override?.apiKey?.trim()) {
    return { baseUrl: normalizeBase(override.baseUrl), apiKey: override.apiKey.trim() };
  }
  const b = envBase();
  const k = envKey();
  if (b && k) return { baseUrl: b, apiKey: k };
  return null;
}

export function evolutionEnvConfigured(override?: EvolutionCreds | null): boolean {
  return resolveEvolutionCreds(override) !== null;
}

/** Evolution aceita apikey; alguns proxies também Bearer */
function evolutionHeaders(apiKey: string, jsonBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
  if (jsonBody) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

function evolutionGetHeaders(apiKey: string): Record<string, string> {
  return evolutionHeaders(apiKey, false);
}

/** Junta base + path sem barra dupla */
function apiUrl(base: string, path: string): string {
  const b = normalizeBase(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
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
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<{ phone: string | null; state: string | null }> {
  try {
    const res2 = await fetch(apiUrl(baseUrl, "/instance/fetchInstances"), {
      headers: evolutionGetHeaders(apiKey),
    });
    if (!res2.ok) return { phone: null, state: null };
    const list = (await res2.json()) as unknown;
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
    const createRes = await fetch(apiUrl(c.baseUrl, "/instance/create"), {
      method: "POST",
      headers: evolutionHeaders(c.apiKey, true),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    if (!createRes.ok && createRes.status !== 409) {
      const t = await createRes.text();
      return { base64: null, error: "http", detail: `${createRes.status}: ${t.slice(0, 200)}` };
    }

    const connectRes = await fetch(apiUrl(c.baseUrl, `/instance/connect/${encodeURIComponent(instanceName)}`), {
      headers: evolutionGetHeaders(c.apiKey),
    });

    if (!connectRes.ok) {
      const t = await connectRes.text();
      return { base64: null, error: "http", detail: t.slice(0, 240) };
    }

    const data = (await connectRes.json()) as Record<string, unknown>;
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
    const createRes = await fetch(apiUrl(c.baseUrl, "/instance/create"), {
      method: "POST",
      headers: evolutionHeaders(c.apiKey, true),
      body: JSON.stringify(body),
    });
    createHttpStatus = createRes.status;
    if (!createRes.ok && createRes.status !== 409) {
      const t = await createRes.text();
      if (createRes.status === 401) {
        createErrorHint =
          "401: API Key inválida ou não autorizada. Confira a Global API Key no painel da Evolution (AUTHENTICATION_API_KEY).";
      } else {
        createErrorHint = `${createRes.status}: ${t.slice(0, 160)}`;
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
    const res = await fetch(
      apiUrl(c.baseUrl, `/instance/connectionState/${encodeURIComponent(instanceName)}`),
      { headers: evolutionGetHeaders(c.apiKey) },
    );
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      if (res.status === 404) {
        return fetchPhoneFromInstancesList(c.baseUrl, c.apiKey, instanceName);
      }
      return { phone: null, state: null, detail: text.slice(0, 200) };
    }

    let phone = extractPhoneFromUnknown(data);
    let state = extractState(data);

    if (!phone && res.ok) {
      const fromList = await fetchPhoneFromInstancesList(c.baseUrl, c.apiKey, instanceName);
      phone = phone ?? fromList.phone;
      state = state ?? fromList.state;
    }

    if (!phone && (res.status === 404 || !res.ok)) {
      const fromList = await fetchPhoneFromInstancesList(c.baseUrl, c.apiKey, instanceName);
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
