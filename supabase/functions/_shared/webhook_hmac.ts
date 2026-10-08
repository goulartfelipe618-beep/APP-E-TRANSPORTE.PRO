/**
 * HMAC-SHA256 (hex) para webhooks inbound (Edge Functions / Deno).
 *
 * Secret: WEBHOOK_INBOUND_HMAC_SECRET (env da Edge ou app_internal_secrets).
 * Cabeçalho: x-webhook-signature = digest hex do corpo bruto UTF-8.
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

export async function resolveWebhookHmacSecret(
  lookup?: (key: string) => Promise<string | null>,
): Promise<string> {
  const fromEnv = Deno.env.get("WEBHOOK_INBOUND_HMAC_SECRET")?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (!lookup) return "";
  try {
    return ((await lookup("WEBHOOK_INBOUND_HMAC_SECRET")) ?? "").trim();
  } catch {
    return "";
  }
}

export async function verifyWebhookHmac(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  if (!secret) {
    return {
      ok: false,
      status: 503,
      body: JSON.stringify({ error: "Webhook HMAC não configurado" }),
    };
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

/** Se o secret existir, a assinatura é obrigatória. Sem secret, o caller decide o fail-closed. */
export async function requireWebhookHmacIfConfigured(
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const secret = await resolveWebhookHmacSecret();
  if (!secret) return { ok: true };
  return verifyWebhookHmac(secret, rawBody, signatureHeader);
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
