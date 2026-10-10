import { supabase } from "@/integrations/supabase/client";

/** Persistido entre abas; alinhado ao padrão etp_* do projeto. */
export const CLIENT_REVOKE_ACK_KEY = "etp_client_revoke_ack_v1";

function readAckRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CLIENT_REVOKE_ACK_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function parseIsoMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function readRevokeAckMs(): number | null {
  const raw = readAckRaw();
  if (!raw) return null;
  return parseIsoMs(raw);
}

export function setRevokeAckFromIso(iso: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!parseIsoMs(iso)) return;
    localStorage.setItem(CLIENT_REVOKE_ACK_KEY, iso);
  } catch {
    /* ignore */
  }
}

export function clearRevokeAck(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLIENT_REVOKE_ACK_KEY);
  } catch {
    /* ignore */
  }
}

const REVOKE_RETRY_MS = 45_000;
const REVOKE_CACHE_KEY = "etp_revoke_at_cache_v1";
const REVOKE_CACHE_MS = 50_000;
let revokeInflight: Promise<string | null> | null = null;
let revokeRetryAt = 0;

function readRevokeCache(): string | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVOKE_CACHE_KEY) || "null") as {
      iso?: string;
      at?: number;
    } | null;
    if (!parsed?.iso || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > REVOKE_CACHE_MS) return null;
    return parsed.iso;
  } catch {
    return null;
  }
}

function writeRevokeCache(iso: string): void {
  try {
    localStorage.setItem(REVOKE_CACHE_KEY, JSON.stringify({ iso, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export async function fetchServerRevokedAtIso(): Promise<string | null> {
  const cached = readRevokeCache();
  if (cached) return cached;
  if (revokeInflight) return revokeInflight;
  if (Date.now() < revokeRetryAt) return null;

  revokeInflight = (async () => {
    const { data, error } = await supabase
      .from("client_session_revocation")
      .select("revoked_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      revokeRetryAt = Date.now() + REVOKE_RETRY_MS;
      return null;
    }
    revokeRetryAt = 0;
    if (!data?.revoked_at) return null;
    writeRevokeCache(data.revoked_at);
    return data.revoked_at;
  })().finally(() => {
    revokeInflight = null;
  });

  return revokeInflight;
}

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readJwtPayload(accessToken: string): { iat?: number; session_id?: string } | null {
  try {
    const [, payloadB64] = accessToken.split(".");
    if (!payloadB64) return null;
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { iat?: number; session_id?: string };
  } catch {
    return null;
  }
}

/** `session_id` do access token. Identifica este login, não o usuário. */
export function readJwtSessionId(accessToken: string): string | null {
  const sid = readJwtPayload(accessToken)?.session_id;
  if (typeof sid !== "string" || !SESSION_ID_RE.test(sid)) return null;
  return sid;
}

/**
 * Marca este login como o único da conta e revoga os outros no servidor.
 * Chamar só depois de um sign-in novo, antes de consultar dados.
 */
export async function claimExclusiveSession(): Promise<boolean> {
  const { error } = await supabase.rpc("claim_exclusive_session");
  return !error;
}

/** `iat` do access token (ms). Usado quando ainda não há ack em LS (primeira carga / novo browser). */
export function readJwtIatMs(accessToken: string): number | null {
  const iat = readJwtPayload(accessToken)?.iat;
  if (typeof iat !== "number" || !Number.isFinite(iat)) return null;
  return iat * 1000;
}
