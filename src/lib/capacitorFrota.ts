/** Domínios do painel. Links fora disto nunca entram no app. */
const FROTA_HOSTS = new Set([
  "e-transporte.pro",
  "www.e-transporte.pro",
  "app.e-transporte.pro",
  "business.transporteexecutivo.com",
]);

/** Pacote Android do aplicativo do motorista. O do painel continua pro.etransporte.frota. */
export const MOTORISTA_APP_ID = "pro.etransporte.motorista";

const SHELL_KEY = "etp_native_shell";
const TOKEN_KEY = "etp_motorista_app_token";
const UUID_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  lembrarTokenAplicativoMotorista(next);
  window.history.replaceState(window.history.state, "", next);
  return true;
}

/** App já aberto: o React Router escuta `popstate`. */
export function applyFrotaDeepLink(raw: string): boolean {
  const next = frotaPathFromAppUrl(raw);
  if (!next || typeof window === "undefined") return false;
  lembrarTokenAplicativoMotorista(next);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return true;
  window.history.pushState(window.history.state, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
}

/** Tira o token do link exclusivo, de um caminho /frota/acesso/:token, ou do UUID colado. */
export function tokenDoTextoDeAcesso(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (UUID_TOKEN.test(text)) return text.toLowerCase();
  const noCaminho = text.match(
    /\/frota\/acesso\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i,
  );
  if (noCaminho?.[1]) return noCaminho[1].toLowerCase();
  return null;
}

export function marcarShellNativo(applicationId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHELL_KEY, applicationId === MOTORISTA_APP_ID ? "motorista" : "painel");
  } catch {
    /* ignore */
  }
}

/** Verdadeiro só no aplicativo instalável do motorista, nunca no site nem no app do painel. */
export function aplicativoEhDoMotorista(): boolean {
  if (!isCapacitorNative() || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SHELL_KEY) === "motorista";
  } catch {
    return false;
  }
}

export function tokenAplicativoMotoristaGuardado(): string | null {
  if (!aplicativoEhDoMotorista()) return null;
  try {
    return tokenDoTextoDeAcesso(localStorage.getItem(TOKEN_KEY) ?? "");
  } catch {
    return null;
  }
}

export function lembrarTokenAplicativoMotorista(tokenOuCaminho: string): void {
  if (!aplicativoEhDoMotorista()) return;
  const token = tokenDoTextoDeAcesso(tokenOuCaminho);
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function limparTokenAplicativoMotorista(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Primeira rota do aplicativo do motorista. O link que abriu o app ganha do token guardado. */
export function rotaInicialAplicativoMotorista(tokenGuardado: string | null, launchPath: string | null): string {
  if (launchPath === "/frota" || (launchPath?.startsWith("/frota/") ?? false)) return launchPath;
  const token = tokenDoTextoDeAcesso(tokenGuardado ?? "");
  if (token) return `/frota/acesso/${token}`;
  return "/aplicativo-motorista";
}

/** Lê o link que abriu o app e, no aplicativo do motorista, não cai no login do painel. */
export async function primeNativeShell(): Promise<void> {
  if (!isCapacitorNative()) return;
  const { App } = await import("@capacitor/app");
  const info = await App.getInfo();
  marcarShellNativo(info.id);
  const launch = await App.getLaunchUrl();
  if (launch?.url && primeFrotaDeepLink(launch.url)) return;
  if (!aplicativoEhDoMotorista() || typeof window === "undefined") return;
  const next = rotaInicialAplicativoMotorista(tokenAplicativoMotoristaGuardado(), null);
  window.history.replaceState(window.history.state, "", next);
}
