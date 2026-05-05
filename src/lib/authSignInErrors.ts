import type { AuthError } from "@supabase/supabase-js";

/**
 * Mensagens claras em PT para falhas de `signInWithPassword` (o servidor devolve muitas vezes só 400 + texto em inglês).
 */
export function formatAuthSignInError(error: AuthError): string {
  const raw = (error.message || "").trim();
  const lower = raw.toLowerCase();
  const code =
    "code" in error && typeof (error as { code?: string }).code === "string"
      ? (error as { code?: string }).code
      : undefined;
  const status = typeof error.status === "number" ? error.status : undefined;

  if (
    code === "invalid_credentials" ||
    lower.includes("invalid login") ||
    lower.includes("invalid email or password") ||
    lower.includes("invalid_grant") ||
    raw === "Invalid login credentials"
  ) {
    return "E-mail ou palavra-passe incorretos. Se não se lembrar da senha, use «Esqueci minha senha».";
  }

  if (
    code === "email_not_confirmed" ||
    lower.includes("email not confirmed") ||
    lower.includes("confirm your email")
  ) {
    return "Confirme o endereço de e-mail (verifique a caixa de entrada e o spam) antes de iniciar sessão.";
  }

  if (lower.includes("user_banned") || lower.includes("user has been banned") || code === "user_banned") {
    return "Esta conta não pode iniciar sessão. Contacte o suporte.";
  }

  if (lower.includes("too many requests") || status === 429) {
    return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  if (!raw) {
    return "Não foi possível iniciar sessão. Verifique a ligação à Internet e tente novamente.";
  }

  return raw;
}
