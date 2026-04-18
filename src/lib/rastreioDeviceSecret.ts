/**
 * Helpers para gestão do `device_secret` que autentica o device do cliente
 * no rastreio público (/rastreio/:token).
 *
 * Fluxo:
 *   1. Cliente abre o link. Browser lê `localStorage["etp_rastreio_secret:<token>"]`.
 *   2. Se não existir, é gerado (quando o cliente clicar em "Iniciar viagem")
 *      e gravado.
 *   3. Nas chamadas `iniciar_rastreio_publico` e `enviar_posicao_publico` o
 *      secret vai como argumento. O DB compara com o que guardou da primeira
 *      inicialização — só o mesmo device continua a enviar posição.
 *
 * Segurança:
 *   - 256 bits de entropia (32 bytes hex).
 *   - Gerado com `crypto.getRandomValues` (CSPRNG).
 *   - NUNCA entra em logs ou respostas GET; apenas passado como parâmetro a
 *     RPCs SECURITY DEFINER.
 */

const KEY_PREFIX = "etp_rastreio_secret:";

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Gera um novo device_secret (32 bytes hex = 64 chars = 256 bits). */
export function gerarDeviceSecret(): string {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Crypto API indisponível neste navegador.");
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** Lê o secret previamente guardado para este token (ou null). */
export function lerDeviceSecret(token: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${token}`);
  } catch {
    return null;
  }
}

/** Guarda o secret em localStorage para este token. */
export function guardarDeviceSecret(token: string, secret: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${token}`, secret);
  } catch {
    /* quota/privada — ignora silenciosamente, o cliente não vai conseguir
       persistir mas pode continuar a viagem dentro da mesma aba (em memória). */
  }
}

/** Apaga o secret (após concluir viagem, p.ex.). */
export function apagarDeviceSecret(token: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${KEY_PREFIX}${token}`);
  } catch {
    /* ignore */
  }
}
