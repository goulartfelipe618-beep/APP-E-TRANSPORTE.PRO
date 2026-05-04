/** Regras alinhadas à Edge Function `motorista-frota-portal` (bootstrap / reset). */
export function validateMotoristaPortalPassword(password: string): string | null {
  if (password.length < 12) return "A senha deve ter pelo menos 12 caracteres.";
  if (password.length > 128) return "Senha demasiado longa.";
  if (!/[a-z]/.test(password)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Inclua pelo menos um símbolo (ex.: ! @ # ?).";
  return null;
}
