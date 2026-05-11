/**
 * Validação defensiva de URLs externas (href / src) para reduzir XSS e exfiltração.
 * Persistência: validar antes de insert/update; render: usar variantes "safe" em <a href> / <img src>.
 *
 * Supabase Storage público: mesmo host que VITE_SUPABASE_URL e path contendo /storage/v1/object/
 * Hosts extra (thumbnails YouTube, etc.): VITE_MEDIA_HOST_ALLOWLIST=host1,host2 (sem scheme).
 */

function readEnv(key: string): string | undefined {
  if (typeof import.meta === "undefined" || !import.meta.env) return undefined;
  const v = (import.meta.env as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function supabaseProjectHost(): string | null {
  const raw = readEnv("VITE_SUPABASE_URL")?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const DEFAULT_MEDIA_HOST_ALLOWLIST = new Set(
  [
    "i.ytimg.com",
    "img.youtube.com",
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "player.vimeo.com",
    "vimeo.com",
    "lh3.googleusercontent.com",
  ].map((h) => h.toLowerCase()),
);

function extraMediaHostsFromEnv(): Set<string> {
  const raw = readEnv("VITE_MEDIA_HOST_ALLOWLIST");
  const set = new Set<string>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(",")) {
    const h = part.trim().toLowerCase();
    if (h) set.add(h);
  }
  return set;
}

function hasNoUrlCredentials(u: URL): boolean {
  return !u.username && !u.password;
}

/** http(s):// sem credenciais — abrir em nova aba (ex.: destino de QR); rejeita `javascript:` e similares. */
export function assertSafeHttpUrlForNavigation(raw: string | null | undefined): URL {
  const t = raw?.trim();
  if (!t) throw new Error("empty");
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new Error("parse");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
  if (!hasNoUrlCredentials(u)) throw new Error("credentials");
  return u;
}

export function assertHttpsUrlForHref(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!hasNoUrlCredentials(u)) return null;
  if (!u.hostname) return null;
  return u.toString();
}

const MAILTO_MAX = 2048;

/** https:// ou mailto: (sem credenciais em https); útil para links de acesso / contacto. */
export function assertSafeHref(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^mailto:/i.test(t)) {
    if (t.length > MAILTO_MAX) return null;
    try {
      const u = new URL(t);
      if (u.protocol !== "mailto:") return null;
      return t;
    } catch {
      return null;
    }
  }
  return assertHttpsUrlForHref(t);
}

function isSupabaseStorageObjectUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  const project = supabaseProjectHost();
  if (!project || host !== project) return false;
  const p = u.pathname.toLowerCase();
  return p.includes("/storage/v1/object/");
}

function isAllowlistedMediaHost(host: string): boolean {
  const h = host.toLowerCase();
  if (DEFAULT_MEDIA_HOST_ALLOWLIST.has(h)) return true;
  return extraMediaHostsFromEnv().has(h);
}

/**
 * Recurso de imagem/vídeo seguro: HTTPS (Supabase object ou host allowlist), blob: (preview local)
 * ou path absoluto na mesma origem (/assets/... vindo do bundler).
 */
export function isSafeMediaSrcUrl(raw: string | null | undefined): boolean {
  const t = raw?.trim();
  if (!t) return false;

  if (t.startsWith("blob:")) {
    try {
      const u = new URL(t);
      return u.protocol === "blob:";
    } catch {
      return false;
    }
  }

  if (typeof window !== "undefined" && t.startsWith("/") && !t.startsWith("//")) {
    if (!t.includes(":")) return true;
    return false;
  }

  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!hasNoUrlCredentials(u)) return false;
  if (isSupabaseStorageObjectUrl(u)) return true;
  if (isAllowlistedMediaHost(u.hostname)) return true;
  return false;
}

export function safeMediaSrc(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return isSafeMediaSrcUrl(raw) ? raw.trim() : undefined;
}

export function safeHrefForRender(raw: string | null | undefined): string | undefined {
  const v = assertSafeHref(raw);
  return v ?? undefined;
}
