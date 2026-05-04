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

/** Hostnames do site de marketing — não usar para links partilháveis do painel (rastreio, QR). */
function isMarketingSiteHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "e-transporte.pro" || h === "www.e-transporte.pro";
}

/**
 * Origem para links públicos `/rastreio/:token` (cliente/motorista).
 * Prioriza domínio da app (evita `VITE_APP_PUBLIC_URL` apontar para o site de marketing).
 */
export function getShareableRastreioBaseUrl(): string {
  const geo = (import.meta.env.VITE_GEO_RASTREIO_APP_ORIGIN as string | undefined)?.trim();
  if (geo && geo.length > 0) {
    try {
      return new URL(geo).origin;
    } catch {
      return geo.replace(/\/$/, "");
    }
  }
  const motorista = (import.meta.env.VITE_MOTORISTA_VERIFICACAO_APP_ORIGIN as string | undefined)?.trim();
  if (motorista && motorista.length > 0) {
    try {
      return new URL(motorista).origin;
    } catch {
      return motorista.replace(/\/$/, "");
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      const host = new URL(window.location.href).hostname;
      if (!isMarketingSiteHostname(host)) {
        return window.location.origin.replace(/\/$/, "");
      }
    } catch {
      return window.location.origin.replace(/\/$/, "");
    }
  }
  const appUrl = (import.meta.env.VITE_APP_PUBLIC_URL as string | undefined)?.trim();
  if (appUrl && appUrl.length > 0) {
    try {
      const u = new URL(appUrl);
      if (!isMarketingSiteHostname(u.hostname)) return u.origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return appUrl?.replace(/\/$/, "") || "";
}

export function buildRastreioShareUrl(token: string): string {
  const base = getShareableRastreioBaseUrl();
  return `${base}/rastreio/${encodeURIComponent(token)}`;
}
