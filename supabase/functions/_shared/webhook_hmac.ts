/**
 * HMAC-SHA256 (hex) para webhooks inbound (Edge Functions / Deno).
 * Documentação: API & Webhooks — validação de assinatura HMAC.
 *
 * Variável: WEBHOOK_INBOUND_HMAC_SECRET — se definida, o pedido deve incluir
 * o cabeçalho `x-webhook-signature` com o mesmo digest do corpo bruto (UTF-8).
 */

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return acc === 0;
}

export async function requireWebhookHmacIfConfigured(
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const secret = Deno.env.get("WEBHOOK_INBOUND_HMAC_SECRET")?.trim();
  if (!secret) {
    return { ok: true };
  }

  const provided = (signatureHeader || "").trim().toLowerCase();
  if (!provided) {
    return {
      ok: false,
      status: 401,
      body: JSON.stringify({ error: "Assinatura HMAC em falta (cabeçalho x-webhook-signature)" }),
    };
  }

  const expected = await hmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualHex(provided, expected.toLowerCase())) {
    return {
      ok: false,
      status: 401,
      body: JSON.stringify({ error: "Assinatura HMAC inválida" }),
    };
  }

  return { ok: true };
}

export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let acc = 0;
  for (let i = 0; i < ba.length; i++) acc |= ba[i] ^ bb[i];
  return acc === 0;
}
