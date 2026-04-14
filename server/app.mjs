import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { z } from "zod";
import { logger } from "./logger.mjs";
import { authSupabaseMiddleware } from "./middleware/authSupabase.mjs";
import { originAllowlistMiddleware } from "./middleware/originAllowlist.mjs";
import { verifyWebhookHmacMiddleware } from "./middleware/verifyWebhookHmac.mjs";

const EchoBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

/** Corpo vazio ou estritamente vazio (sem campos extra) — modelo para rotas POST sem payload. */
const EmptyJsonBodySchema = z.object({}).strict();

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

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) || true,
      maxAge: 86400,
    }),
  );

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

  /** Rota de exemplo com limite reforçado (substitua por POST /auth/login real se migrar login para aqui). */
  app.post("/auth/login-attempt", loginLimiter, (req, res) => {
    const parsed = EmptyJsonBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    res.status(501).json({ error: "Login continua no Supabase Auth no cliente; use esta rota como modelo de rate limit." });
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
