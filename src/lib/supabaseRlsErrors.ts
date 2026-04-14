import type { PostgrestError } from "@supabase/supabase-js";

/** Deteta falhas típicas de RLS / permissão nas respostas do PostgREST. */
export function isRlsOrPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as PostgrestError & { status?: number };
  const code = String(e.code || "");
  const msg = String(e.message || "").toLowerCase();
  const details = String((e as { details?: string }).details || "").toLowerCase();
  if (code === "42501" || code === "PGRST301") return true;
  if (e.status === 401 || e.status === 403) return true;
  if (msg.includes("permission denied") || msg.includes("policy")) return true;
  if (details.includes("permission denied") || details.includes("policy")) return true;
  return false;
}
