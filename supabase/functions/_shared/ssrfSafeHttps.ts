/**
 * Validação de URLs HTTPS antes de `fetch` com input influenciado pelo utilizador.
 * Bloqueia redes privadas, link-local, metadados cloud comuns e nomes internos — mitigação SSRF / proxy aberto.
 */

function isBlockedIpv4Literal(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host === "0.0.0.0") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isBlockedIpv6Literal(host: string): boolean {
  const inner = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1).toLowerCase()
    : host.toLowerCase();
  if (!inner.includes(":")) return false;
  if (inner === "::1" || inner === "0:0:0:0:0:0:0:1") return true;
  if (/^fe[89ab][0-9a-f]*:/i.test(inner)) return true;
  if (inner.startsWith("fc") || inner.startsWith("fd")) return true;
  return false;
}

export function parsePublicHttpsUrl(urlStr: string): URL {
  let u: URL;
  try {
    u = new URL(urlStr.trim());
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "https:") {
    throw new Error("Apenas HTTPS é permitido");
  }
  const host = u.hostname;
  if (!host) throw new Error("Host inválido");
  const lower = host.toLowerCase();

  if (lower === "localhost" || lower.endsWith(".localhost")) {
    throw new Error("Host não permitido");
  }
  if (lower.endsWith(".local")) {
    throw new Error("Host não permitido");
  }
  if (lower === "metadata.google.internal" || lower.endsWith(".internal")) {
    throw new Error("Host não permitido");
  }

  if (isBlockedIpv4Literal(lower)) {
    throw new Error("Host não permitido");
  }
  if (isBlockedIpv6Literal(host)) {
    throw new Error("Host não permitido");
  }

  return u;
}

/** Base origin `https://host:port` (sem path) para concatenar paths controlados à parte. */
export function assertHttpsBaseUrl(urlStr: string): string {
  const u = parsePublicHttpsUrl(urlStr);
  return `${u.protocol}//${u.host}`;
}

/** URL completa já validada (ex.: webhook configurado na base). */
export function assertHttpsFullUrl(urlStr: string): string {
  return parsePublicHttpsUrl(urlStr).toString();
}
