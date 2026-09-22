/**
 * Cliente do comunicador WhatsApp (UAZAPI). Sem chamadas à Evolution API.
 */

import { supabase } from "@/integrations/supabase/client";

/** Remove espaços invisíveis e quebras de linha coladas ao copiar a API Key */
export function sanitizeApiKey(key: string): string {
  return key
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r?\n/g, "");
}

async function invokeComunicadorFn<T>(name: string, body: Record<string, unknown>): Promise<{
  data: T | null;
  error: { message: string; context?: Response } | null;
}> {
  const { data: sess } = await supabase.auth.getSession();
  const access = sess.session?.access_token;
  if (!access) {
    return { data: null, error: { message: "Sessão expirada. Entre novamente." } };
  }
  return await supabase.functions.invoke<T>(name, {
    body,
    headers: { Authorization: `Bearer ${access}` },
  });
}

/** Extrai número exibível a partir de JID ou string só dígitos */
export function parseWhatsappPhoneFromJid(jid: string | undefined | null): string | null {
  if (!jid || typeof jid !== "string") return null;
  const digits = jid.split("@")[0]?.replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  return digits;
}

/** Cria/recupera instância UAZAPI e retorna o QR. */
export async function fetchEvolutionMotoristaQrFromServer(opts?: {
  target?: "own" | "sistema";
}): Promise<{
  base64: string | null;
  instanceName?: string;
  detail?: string;
  code?: string;
}> {
  const { data, error } = await invokeComunicadorFn<{
    base64?: string;
    instanceName?: string;
    error?: string;
    detail?: string;
    code?: string;
  }>("evolution-motorista-qr", { target: opts?.target ?? "own" });

  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = (await ctx.json()) as { error?: string; detail?: string };
        if (typeof body.detail === "string" && body.detail.trim()) {
          detail = body.detail.trim();
        } else if (typeof body.error === "string" && body.error.trim()) {
          detail = body.detail ? `${body.error}: ${body.detail}` : body.error.trim();
        }
      }
    } catch {
      /* corpo não-JSON ou vazio */
    }
    return { base64: null, detail };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return {
      base64: null,
      detail: (data.detail as string) || String(data.error),
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }
  if (!data?.base64) {
    return { base64: null, detail: "Resposta sem QR Code." };
  }
  return { base64: data.base64, instanceName: data.instanceName };
}

/** Sincroniza número, foto e nome do perfil a partir da UAZAPI. */
export async function fetchEvolutionMotoristaSyncFromServer(opts?: {
  target?: "own" | "sistema";
}): Promise<{
  phone: string | null;
  profilePicUrl: string | null;
  profileName: string | null;
  state: string | null;
  connected: boolean;
  detail?: string;
}> {
  const { data, error } = await invokeComunicadorFn<{
    phone?: string | null;
    profilePicUrl?: string | null;
    profileName?: string | null;
    state?: string | null;
    connected?: boolean;
    error?: string;
  }>("evolution-motorista-sync", { target: opts?.target ?? "own" });

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

/** Remove a instância UAZAPI do motorista. */
export async function fetchEvolutionMotoristaDeleteFromServer(opts?: {
  target?: "own" | "sistema";
}): Promise<{ ok: boolean; detail?: string }> {
  const { data, error } = await invokeComunicadorFn<{ ok?: boolean; error?: string; detail?: string }>(
    "evolution-motorista-delete",
    { target: opts?.target ?? "own" },
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

export async function sendUazapiWhatsappCard(opts: {
  number: string;
  text: string;
  title?: string;
  buttons?: Array<{ id: string; text: string }>;
  pdf?: { base64: string; filename: string } | null;
}): Promise<{ ok: boolean; error?: string; canal?: string; warning?: string }> {
  const { data, error } = await invokeComunicadorFn<{
    ok?: boolean;
    error?: string;
    canal?: string;
    warning?: string;
  }>("uazapi-send-card", opts as Record<string, unknown>);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "Falha ao enviar o card no WhatsApp." };
  }
  return { ok: true, canal: data.canal, warning: data.warning };
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
