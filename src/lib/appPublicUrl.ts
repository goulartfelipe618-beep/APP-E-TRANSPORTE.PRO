/**
 * URL pública do site (links partilháveis, QR em PDF, etc.).
 * Preferir `VITE_APP_PUBLIC_URL` em build (ex.: https://app.seudominio.com) para o QR
 * funcionar quando o PDF é gerado em localhost ou em preview com outro host.
 */
export function getAppPublicOrigin(): string {
  const envBase = (import.meta.env.VITE_APP_PUBLIC_URL as string | undefined)?.trim();
  if (envBase && envBase.length > 0) {
    try {
      return new URL(envBase).origin;
    } catch {
      return envBase.replace(/\/$/, "");
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

/**
 * Origem usada só no QR do selo do motorista (evita apontar para site de marketing).
 * Defina `VITE_MOTORISTA_VERIFICACAO_APP_ORIGIN` com a URL exacta do painel (ex.: https://app.e-transporte.pro).
 */
export function getMotoristaVerificacaoAppOrigin(): string {
  const dedicated = (import.meta.env.VITE_MOTORISTA_VERIFICACAO_APP_ORIGIN as string | undefined)?.trim();
  if (dedicated && dedicated.length > 0) {
    try {
      return new URL(dedicated).origin;
    } catch {
      return dedicated.replace(/\/$/, "");
    }
  }
  return getAppPublicOrigin();
}
