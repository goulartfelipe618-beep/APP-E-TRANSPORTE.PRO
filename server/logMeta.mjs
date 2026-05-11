/** Chaves e padrões a nunca escrever em claro nos logs Winston. */
export const SENSITIVE_LOG_KEYS = new Set([
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "credit_card",
  "cpf",
  "cnpj",
]);

function looksLikeJwt(s) {
  if (typeof s !== "string" || s.length < 40) return false;
  const parts = s.split(".");
  if (parts.length < 3) return false;
  return parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}

function looksLikeOpaqueBlob(s) {
  if (typeof s !== "string" || s.length < 120) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(s);
}

/**
 * Percorre meta recursivamente: mascara chaves sensíveis, JWT e cadeias longas tipo segredo/base64.
 */
export function sanitizeLogMeta(value, depth = 0) {
  if (depth > 8) return "[max-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (looksLikeJwt(value) || looksLikeOpaqueBlob(value)) return "[redacted]";
    return value.length > 2500 ? `${value.slice(0, 2500)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeLogMeta(v, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_LOG_KEYS.has(k.toLowerCase())) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = sanitizeLogMeta(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
