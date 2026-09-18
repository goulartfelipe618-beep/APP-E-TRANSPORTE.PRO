import { fingerprintNormalizedEmail } from "@/lib/emailFingerprint";

/**
 * Notifica o backend (Edge) de uma tentativa de login falhada.
 * Usa a chave anon (não o JWT de sessão, que no ecrã de login pode estar expirado → 401 no gateway).
 */
export async function reportAuthLoginFailure(emailNormalized: string): Promise<void> {
  const trimmed = emailNormalized.trim().toLowerCase();
  if (!trimmed) return;
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
  const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (!base || !anon) return;
  try {
    const email_fingerprint = await fingerprintNormalizedEmail(trimmed);
    await fetch(`${base}/functions/v1/log-auth-login-failure`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ outcome: "failure", email_fingerprint }),
    });
  } catch {
    /* falha silenciosa — não bloquear o fluxo de login */
  }
}
