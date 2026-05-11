import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger.mjs";
import { authSupabaseMiddleware } from "./middleware/authSupabase.mjs";
import { originAllowlistMiddleware } from "./middleware/originAllowlist.mjs";
import { verifyWebhookHmacMiddleware } from "./middleware/verifyWebhookHmac.mjs";
import { registerMercadoPagoRoutes } from "./mercadoPagoPayments.mjs";

const EchoBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

/** Payload de tentativa de login falhada (sem password; fingerprint SHA-256 do e-mail normalizado). */
const LoginAttemptBodySchema = z
  .object({
    outcome: z.literal("failure"),
    emailFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .transform((s) => s.toLowerCase()),
  })
  .strict();

function ipPrefixFromExpress(req) {
  const xf = req.headers["x-forwarded-for"];
  const first =
    typeof xf === "string" && xf.trim()
      ? xf.split(",")[0]?.trim()
      : "";
  const raw = first || req.ip || "";
  if (!raw) return null;
  if (raw.includes(":")) {
    const p = raw.split(":");
    return p.length >= 4 ? `${p.slice(0, 4).join(":")}::/64` : null;
  }
  const oct = raw.split(".");
  return oct.length === 4 ? `${oct[0]}.${oct[1]}.${oct[2]}.x` : null;
}

function uaShortFromExpress(req) {
  const ua = req.get("User-Agent");
  if (!ua) return null;
  return ua.length > 160 ? `${ua.slice(0, 157)}...` : ua;
}

/** Payload genérico de webhook (n8n / Evolution); aceita objeto ou array na raiz. */
const WebhookInboundBodySchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

/**
 * API Node opcional (Helmet, rate limit, Zod, JWT Supabase, logs sem segredos).
 * Secção da documentação: Backend Node.js + Proteção de API.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOriginsList =
    process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const corsOrigin =
    allowedOriginsList.length > 0
      ? allowedOriginsList
      : process.env.NODE_ENV === "production"
        ? false
        : true;

  app.use(
    cors({
      origin: corsOrigin,
      maxAge: 86400,
    }),
  );

  if (process.env.NODE_ENV === "production" && allowedOriginsList.length === 0) {
    logger.warn(
      "ALLOWED_ORIGINS não definido: pedidos cross-origin ao browser serão recusados por CORS. " +
        "Defina ALLOWED_ORIGINS com a origem do front (ex.: https://app.seudominio.com).",
    );
  }

  /**
   * Webhooks: limite próprio, mais alto que login (n8n pode enviar rajadas).
   * Não passa pelo express.json — corpo bruto para HMAC-SHA256 igual ao Edge.
   */
  const webhookInboundLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_WEBHOOK_MAX || 2000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados webhooks neste intervalo." },
  });

  app.post(
    "/webhooks/inbound",
    express.raw({ type: ["application/json", "application/*+json"], limit: "512kb" }),
    webhookInboundLimiter,
    verifyWebhookHmacMiddleware,
    (req, res) => {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      let json;
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        return res.status(400).json({ error: "JSON inválido" });
      }
      const parsed = WebhookInboundBodySchema.safeParse(json);
      if (!parsed.success) {
        return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
      }
      logger.info("webhook inbound", { bytes: raw.length });
      return res.status(200).json({ ok: true, received: true });
    },
  );

  registerMercadoPagoRoutes(app, {
    authSupabaseMiddleware,
    originAllowlist: originAllowlistMiddleware(),
    rateLimit,
  });

  app.use(express.json({ limit: "100kb" }));
  app.use(originAllowlistMiddleware());

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados pedidos. Tente mais tarde." },
  });
  app.use(globalLimiter);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas tentativas de autenticação." },
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cheerful-bond-builder-api" });
  });

  /** Login falhado: grava em `auth_login_failure_events` com service role (opcional). */
  app.post("/auth/login-attempt", loginLimiter, async (req, res) => {
    const parsed = LoginAttemptBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    const url = process.env.SUPABASE_URL?.trim();
    const sk = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !sk) {
      logger.info("auth_login_failure_events skipped (SUPABASE_SERVICE_ROLE_KEY ausente)");
      return res.status(204).end();
    }
    try {
      const admin = createClient(url, sk);
      const { error } = await admin.from("auth_login_failure_events").insert({
        outcome: "failure",
        email_fingerprint: parsed.data.emailFingerprint,
        ip_prefix: ipPrefixFromExpress(req),
        user_agent_short: uaShortFromExpress(req),
      });
      if (error) {
        logger.error("auth login attempt insert", { message: error.message });
        return res.status(500).json({ error: "Falha ao registar" });
      }
      return res.status(201).json({ ok: true });
    } catch (e) {
      logger.error("auth login attempt unexpected", { message: e instanceof Error ? e.message : "unknown" });
      return res.status(500).json({ error: "Erro interno" });
    }
  });

  app.post("/v1/echo", authSupabaseMiddleware({ optional: false }), (req, res) => {
    const parsed = EchoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    logger.info("echo", { userId: req.supabaseUser?.id });
    return res.json({ ok: true, echo: parsed.data.message });
  });

  app.use((err, req, res, _next) => {
    logger.error("handler error", { message: err?.message, path: req.path });
    const expose = process.env.NODE_ENV !== "production";
    res.status(err.status || 500).json({
      error: expose && err.message ? err.message : "Erro interno",
    });
  });

  return app;
}
