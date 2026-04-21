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

export async function fetchServerRevokedAtIso(): Promise<string | null> {
  const { data, error } = await supabase
    .from("client_session_revocation")
    .select("revoked_at")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.revoked_at) return null;
  return data.revoked_at;
}

/** `iat` do access token (ms). Usado quando ainda não há ack em LS (primeira carga / novo browser). */
export function readJwtIatMs(accessToken: string): number | null {
  try {
    const [, payloadB64] = accessToken.split(".");
    if (!payloadB64) return null;
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(json) as { iat?: number };
    if (typeof p.iat !== "number" || !Number.isFinite(p.iat)) return null;
    return p.iat * 1000;
  } catch {
    return null;
  }
}
