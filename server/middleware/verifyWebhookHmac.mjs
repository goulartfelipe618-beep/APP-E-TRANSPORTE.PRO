import { createHmac } from "node:crypto";
import { logger } from "../logger.mjs";

function hmacSha256Hex(secret, message) {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

/**
 * Alinhado a supabase/functions/_shared/webhook_hmac.ts (Evolution / n8n).
 * Se WEBHOOK_INBOUND_HMAC_SECRET estiver definido, exige cabeçalho x-webhook-signature
 * = HMAC-SHA256(hex) do corpo bruto UTF-8.
 *
 * Espera req.body como Buffer (use express.raw antes de express.json).
 */
export function verifyWebhookHmacMiddleware(req, res, next) {
  const secret = process.env.WEBHOOK_INBOUND_HMAC_SECRET?.trim();
  if (!secret) {
    return next();
  }

  const raw =
    Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : "";

  const provided = (req.get("x-webhook-signature") || "").trim().toLowerCase();
  if (!provided) {
    logger.warn("webhook hmac: assinatura em falta");
    return res.status(401).json({ error: "Assinatura HMAC em falta (x-webhook-signature)" });
  }

  const expected = hmacSha256Hex(secret, raw);
  if (!timingSafeEqualHex(provided, expected.toLowerCase())) {
    logger.warn("webhook hmac: assinatura inválida");
    return res.status(401).json({ error: "Assinatura HMAC inválida" });
  }

  next();
}
