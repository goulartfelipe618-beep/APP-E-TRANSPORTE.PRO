/**
 * Senha padrão para leads FREE (motorista) — manter alinhado a qualquer nó Code n8n
 * que replique esta lógica (acentos removidos, 3 letras + 4 dígitos + ETP).
 */
export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function onlyLettersUpper(input: string): string {
  return stripAccents(input).replace(/[^a-zA-Z]/g, "").toUpperCase();
}

/** Legado: não usar em contas novas. Fórmula previsível a partir do nome e telefone. */
export function computeLeadPassword(nome: string, telefone: string): string {
  const letters = onlyLettersUpper(nome);
  const first3 = (letters.slice(0, 3) || "").padEnd(3, "X");

  const digits = (telefone || "").replace(/\D/g, "");
  const last4 = (digits.slice(-4) || "").padStart(4, "0");

  return `${first3}${last4}ETP`;
}

const PWD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Senha de primeiro acesso: aleatória. O lead entra com recuperação de senha se não a receber por outro canal. */
export function generateLeadPassword(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += PWD_ALPHABET[b % PWD_ALPHABET.length];
  return out;
}
