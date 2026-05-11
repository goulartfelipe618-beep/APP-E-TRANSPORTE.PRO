import { supabase } from "@/integrations/supabase/client";
import { fingerprintNormalizedEmail } from "@/lib/emailFingerprint";

/**
 * Notifica o backend (Edge) de uma tentativa de login falhada.
 * Não envia password nem e-mail em claro — apenas impressão digital SHA-256 do e-mail normalizado.
 */
export async function reportAuthLoginFailure(emailNormalized: string): Promise<void> {
  const trimmed = emailNormalized.trim().toLowerCase();
  if (!trimmed) return;
  try {
    const email_fingerprint = await fingerprintNormalizedEmail(trimmed);
    const { error } = await supabase.functions.invoke("log-auth-login-failure", {
      body: { outcome: "failure", email_fingerprint },
    });
    if (error && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[authLoginFailureReporter]", error.message);
    }
  } catch {
    /* falha silenciosa — não bloquear o fluxo de login */
  }
}
