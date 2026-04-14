/**
 * Reduz open redirect / javascript: em URLs abertas a partir de dados do utilizador.
 * Documentação: Ataques comuns — Open Redirect.
 */
export function assertSafeHttpUrlForNavigation(raw: string): URL {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    throw new Error("URL vazia");
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Apenas http(s) é permitido");
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Host não permitido");
  }
  return u;
}
