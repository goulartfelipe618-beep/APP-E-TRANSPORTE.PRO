import { supabase } from "@/integrations/supabase/client";

export const AUTH_STARTED_AT_KEY = "etp_auth_started_at_v1";
export const AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function safeReadNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

export function readAuthStartedAt(): number | null {
  if (typeof window === "undefined") return null;
  return safeReadNumber(AUTH_STARTED_AT_KEY);
}

export function setAuthStartedAt(ts: number = Date.now()): void {
  try {
    localStorage.setItem(AUTH_STARTED_AT_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export function clearAuthStartedAt(): void {
  try {
    localStorage.removeItem(AUTH_STARTED_AT_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthExpired(startedAt: number, now: number = Date.now()): boolean {
  return now - startedAt >= AUTH_MAX_AGE_MS;
}

/**
 * Retorna `true` se a sessão do Supabase existe e está dentro da validade (24h).
 * Se `startedAt` não existir, iniciamos a contagem agora (melhor esforço).
 */
export async function isSessionValidWithin24h(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return false;

  const startedAt = readAuthStartedAt();
  if (!startedAt) {
    setAuthStartedAt(Date.now());
    return true;
  }

  return !isAuthExpired(startedAt);
}

