/** Domínio público do painel. Links fora disto nunca entram no app. */
const FROTA_HOSTS = new Set(["e-transporte.pro", "www.e-transporte.pro"]);

const CUSTOM_SCHEME = "etransporte:";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
};

/** Verdadeiro só dentro do WebView do Capacitor. No site, é sempre falso. */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Converte um Universal Link / App Link / esquema `etransporte://` na rota interna do React.
 * Devolve null para qualquer URL que não seja o portal /frota.
 */
export function frotaPathFromAppUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  let path = url.pathname || "/";

  if (url.protocol === "https:" || url.protocol === "http:") {
    if (url.protocol !== "https:") return null;
    if (!FROTA_HOSTS.has(host)) return null;
  } else if (url.protocol === CUSTOM_SCHEME) {
    if (host === "frota") {
      path = path.startsWith("/frota") ? path : `/frota${path.startsWith("/") ? path : `/${path}`}`;
    } else if (!FROTA_HOSTS.has(host)) {
      return null;
    }
  } else {
    return null;
  }

  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path.startsWith("/frota")) return null;
  if (path !== "/frota" && !path.startsWith("/frota/")) return null;

  return `${path}${url.search}${url.hash}`;
}

/** Ajusta a rota antes do React montar (abertura a frio pelo link). */
export function primeFrotaDeepLink(raw: string): boolean {
  const next = frotaPathFromAppUrl(raw);
  if (!next || typeof window === "undefined") return false;
  window.history.replaceState(window.history.state, "", next);
  return true;
}

/** App já aberto: o React Router escuta `popstate`. */
export function applyFrotaDeepLink(raw: string): boolean {
  const next = frotaPathFromAppUrl(raw);
  if (!next || typeof window === "undefined") return false;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return true;
  window.history.pushState(window.history.state, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
}

/** Lê o link que abriu o app. Não faz nada no browser. */
export async function primeFrotaLaunchUrl(): Promise<void> {
  if (!isCapacitorNative()) return;
  const { App } = await import("@capacitor/app");
  const launch = await App.getLaunchUrl();
  if (launch?.url) primeFrotaDeepLink(launch.url);
}
