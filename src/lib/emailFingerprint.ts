/** SHA-256 hex (UTF-8) — identificador opaco para o mesmo e-mail, sem armazenar o endereço. */
export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintNormalizedEmail(email: string): Promise<string> {
  return sha256HexUtf8(email.trim().toLowerCase());
}
