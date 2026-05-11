import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment, PreApproval } from "mercadopago";
import { z } from "zod";
import { logger } from "./logger.mjs";

const BILLING_CYCLES = ["monthly", "quarterly", "semiannual", "annual"];
const PAID_PLANS = ["standart", "pro"];

const PLAN_TOTALS = {
  standart: {
    monthly: 89.9,
    quarterly: 239.7,
    semiannual: 419.4,
    annual: 718.8,
  },
  pro: {
    monthly: 109.9,
    quarterly: 299.7,
    semiannual: 539.4,
    annual: 958.8,
  },
};

const CYCLE_FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const CreatePreferenceBodySchema = z
  .object({
    plano: z.enum(PAID_PLANS),
    ciclo: z.enum(BILLING_CYCLES),
    token: z.string().trim().min(8).max(512),
    payment_method_id: z.string().trim().min(1).max(80),
    issuer_id: z.union([z.string(), z.number()]).optional().nullable(),
    installments: z.coerce.number().int().min(1).max(12),
    payer: z
      .object({
        email: z.string().email().max(320).optional(),
        identification: z
          .object({
            type: z.string().trim().max(16).optional(),
            number: z.string().trim().max(32).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .strict();

function normalizePlan(raw) {
  const p = String(raw || "").toLowerCase().trim();
  if (p === "standart" || p === "standard") return "standart";
  if (p === "pro") return "pro";
  return "free";
}

function requireServerEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} em falta`);
  return value;
}

function supabaseAdmin() {
  return createClient(requireServerEnv("SUPABASE_URL"), requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function mpClient() {
  return new MercadoPagoConfig({ accessToken: requireServerEnv("MP_ACCESS_TOKEN") });
}

function planId(plano, ciclo) {
  return `${plano}_${ciclo}`;
}

function externalReference(userId, plano, ciclo) {
  return `mp:${userId}:${plano}:${ciclo}`;
}

function parseExternalReference(ref) {
  const parts = String(ref || "").split(":");
  if (parts.length !== 4 || parts[0] !== "mp") return null;
  const [, userId, plano, ciclo] = parts;
  if (!PAID_PLANS.includes(plano) || !BILLING_CYCLES.includes(ciclo)) return null;
  return { userId, plano, ciclo };
}

async function userRoles(admin, userId) {
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.role);
}

async function applyPaidPlan(admin, { userId, plano, mpCustomerId = null, mpSubscriptionId = null, mpPaymentId = null, mpPlanId }) {
  const { data: row, error: rowErr } = await admin
    .from("user_plans")
    .select("billing_manual_override")
    .eq("user_id", userId)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);

  if (row?.billing_manual_override === true) {
    logger.info("mercadopago: skip plan sync because billing_manual_override", { userId });
    return;
  }

  const { error } = await admin.from("user_plans").upsert(
    {
      user_id: userId,
      plano,
      mp_customer_id: mpCustomerId,
      mp_subscription_id: mpSubscriptionId,
      mp_payment_id: mpPaymentId,
      mp_plan_id: mpPlanId,
      billing_manual_override: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  await admin.from("solicitacoes_motoristas").delete().eq("lead_user_id", userId);
}

async function applyFreeFromMercadoPago(admin, { userId, mpCustomerId = null }) {
  const { data: row, error: rowErr } = await admin
    .from("user_plans")
    .select("billing_manual_override")
    .eq("user_id", userId)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);

  if (row?.billing_manual_override === true) {
    logger.info("mercadopago: skip downgrade because billing_manual_override", { userId });
    return;
  }

  const patch = {
    user_id: userId,
    plano: "free",
    mp_subscription_id: null,
    mp_payment_id: null,
    mp_plan_id: null,
    billing_manual_override: false,
    updated_at: new Date().toISOString(),
  };
  if (mpCustomerId) patch.mp_customer_id = mpCustomerId;

  const { error } = await admin.from("user_plans").upsert(patch, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

function extractMpSignatureParts(signature) {
  const out = {};
  for (const part of String(signature || "").split(",")) {
    const [k, ...rest] = part.split("=");
    if (!k || rest.length === 0) continue;
    out[k.trim()] = rest.join("=").trim();
  }
  return out;
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifyMercadoPagoWebhookSignature(req, parsedBody) {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return { ok: true };

  const signature = req.get("x-signature") || "";
  const requestId = req.get("x-request-id") || "";
  const { ts, v1 } = extractMpSignatureParts(signature);
  const dataId =
    String(req.query?.["data.id"] || req.query?.id || parsedBody?.data?.id || parsedBody?.id || "").trim();

  if (!ts || !v1 || !requestId || !dataId) {
    return { ok: false, status: 401, error: "Assinatura Mercado Pago incompleta" };
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest, "utf8").digest("hex");
  if (!timingSafeEqualHex(expected, v1)) {
    return { ok: false, status: 401, error: "Assinatura Mercado Pago inválida" };
  }

  return { ok: true };
}

function eventKey(body) {
  const type = body?.action || body?.type || "unknown";
  const dataId = body?.data?.id || body?.id || "no-id";
  return `mp:${type}:${dataId}`;
}

async function insertWebhookEvent(admin, body) {
  const id = eventKey(body);
  const { error } = await admin.from("mp_webhook_events").insert({ id });
  if (!error) return { inserted: true };
  const msg = String(error.message || "").toLowerCase();
  if (error.code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
    return { inserted: false, duplicate: true };
  }
  throw new Error(error.message);
}

function dataIdFromWebhook(req, body) {
  return String(req.query?.["data.id"] || req.query?.id || body?.data?.id || body?.id || "").trim();
}

async function resolveFromSubscription(admin, subId, sub) {
  const ref = parseExternalReference(sub?.external_reference);
  if (ref) return ref;

  const { data } = await admin
    .from("user_plans")
    .select("user_id, mp_plan_id")
    .eq("mp_subscription_id", subId)
    .maybeSingle();
  if (!data?.user_id) return null;
  const [plano, ciclo] = String(data.mp_plan_id || "").split("_");
  return {
    userId: data.user_id,
    plano: PAID_PLANS.includes(plano) ? plano : "pro",
    ciclo: BILLING_CYCLES.includes(ciclo) ? ciclo : "monthly",
  };
}

async function handlePaymentWebhook(admin, paymentClient, paymentId) {
  if (!paymentId) return;
  const payment = await paymentClient.get({ id: paymentId });
  const status = String(payment?.status || "").toLowerCase();
  const ref = parseExternalReference(payment?.external_reference);
  if (!ref) {
    logger.warn("mercadopago payment without known external_reference", { paymentId, status });
    return;
  }

  const mpCustomerId = payment?.payer?.id ? String(payment.payer.id) : null;
  if (status === "approved") {
    await applyPaidPlan(admin, {
      userId: ref.userId,
      plano: ref.plano,
      mpCustomerId,
      mpSubscriptionId: null,
      mpPaymentId: String(payment.id || paymentId),
      mpPlanId: planId(ref.plano, ref.ciclo),
    });
    return;
  }

  if (["rejected", "cancelled", "refunded", "charged_back"].includes(status)) {
    await applyFreeFromMercadoPago(admin, { userId: ref.userId, mpCustomerId });
  }
}

async function handlePreApprovalWebhook(admin, preApprovalClient, preApprovalId) {
  if (!preApprovalId) return;
  const sub = await preApprovalClient.get({ id: preApprovalId });
  const resolved = await resolveFromSubscription(admin, preApprovalId, sub);
  if (!resolved) {
    logger.warn("mercadopago preapproval without known user", { preApprovalId, status: sub?.status });
    return;
  }

  const status = String(sub?.status || "").toLowerCase();
  const mpCustomerId = sub?.payer_id ? String(sub.payer_id) : null;
  if (["authorized", "active"].includes(status)) {
    await applyPaidPlan(admin, {
      userId: resolved.userId,
      plano: resolved.plano,
      mpCustomerId,
      mpSubscriptionId: String(sub?.id || preApprovalId),
      mpPaymentId: null,
      mpPlanId: planId(resolved.plano, resolved.ciclo),
    });
    return;
  }

  if (["cancelled", "paused", "rejected"].includes(status)) {
    await applyFreeFromMercadoPago(admin, { userId: resolved.userId, mpCustomerId });
  }
}

export function registerMercadoPagoRoutes(app, { authSupabaseMiddleware, originAllowlist, rateLimit }) {
  const paymentsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_PAYMENTS_MAX || 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas tentativas de pagamento. Tente mais tarde." },
  });

  const mpWebhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MP_WEBHOOK_MAX || 2000),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados webhooks Mercado Pago neste intervalo." },
  });

  app.post(
    "/api/webhooks/mercadopago",
    express.raw({ type: ["application/json", "application/*+json"], limit: "512kb" }),
    mpWebhookLimiter,
    async (req, res) => {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return res.status(400).json({ error: "JSON inválido" });
      }

      const sig = verifyMercadoPagoWebhookSignature(req, body);
      if (!sig.ok) {
        logger.warn("mercadopago webhook signature rejected", { status: sig.status });
        return res.status(sig.status || 401).json({ error: sig.error || "Assinatura inválida" });
      }

      try {
        const admin = supabaseAdmin();
        const inserted = await insertWebhookEvent(admin, body);
        if (inserted.duplicate) return res.status(200).json({ received: true, duplicate: true });

        const client = mpClient();
        const paymentClient = new Payment(client);
        const preApprovalClient = new PreApproval(client);
        const action = `${body?.action || ""} ${body?.type || ""}`.toLowerCase();
        const id = dataIdFromWebhook(req, body);

        if (action.includes("payment")) {
          await handlePaymentWebhook(admin, paymentClient, id);
        } else if (action.includes("preapproval") || action.includes("subscription_preapproval")) {
          await handlePreApprovalWebhook(admin, preApprovalClient, id);
        }

        return res.status(200).json({ received: true });
      } catch (e) {
        logger.error("mercadopago webhook handler", { message: e instanceof Error ? e.message : "unknown" });
        return res.status(500).json({ error: "Erro ao processar webhook" });
      }
    },
  );

  app.post(
    "/api/payments/create-preference",
    express.json({ limit: "100kb" }),
    originAllowlist,
    paymentsLimiter,
    authSupabaseMiddleware({ optional: false }),
    async (req, res) => {
      const parsed = CreatePreferenceBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
      }

      try {
        const admin = supabaseAdmin();
        const user = req.supabaseUser;
        const roles = await userRoles(admin, user.id);
        if (roles.includes("admin_master")) {
          return res.status(403).json({ error: "Conta administrativa não utiliza pagamento Mercado Pago." });
        }
        if (!roles.includes("admin_transfer")) {
          return res.status(403).json({ error: "Apenas motoristas executivos podem subscrever." });
        }

        const { data: planRow, error: planErr } = await admin
          .from("user_plans")
          .select("plano, billing_manual_override")
          .eq("user_id", user.id)
          .maybeSingle();
        if (planErr) throw new Error(planErr.message);

        if (planRow?.billing_manual_override === true) {
          return res.status(403).json({
            error:
              "O plano desta conta está bloqueado pelo administrador. Contacte o suporte para alterações ou para permitir cobrança Mercado Pago.",
          });
        }

        const current = normalizePlan(planRow?.plano);
        const { plano, ciclo, token } = parsed.data;
        if (current === "pro") return res.status(400).json({ error: "A sua conta já está no plano PRÓ." });
        if (current === "standart" && plano !== "pro") {
          return res.status(400).json({ error: "Com plano STANDART, só pode subscrever o upgrade para PRÓ." });
        }

        const client = mpClient();
        const preApproval = new PreApproval(client);
        const amount = PLAN_TOTALS[plano][ciclo];
        const recurrence = CYCLE_FREQUENCY_MONTHS[ciclo];
        const ref = externalReference(user.id, plano, ciclo);
        const payerEmail = parsed.data.payer?.email || user.email;
        if (!payerEmail) return res.status(400).json({ error: "E-mail do pagador em falta." });

        const created = await preApproval.create({
          body: {
            reason: `Assinatura ${plano === "pro" ? "PRÓ" : "STANDART"} E-Transporte.pro`,
            external_reference: ref,
            payer_email: payerEmail,
            card_token_id: token,
            back_url: process.env.MP_BACK_URL || process.env.APP_PUBLIC_URL || undefined,
            status: "authorized",
            auto_recurring: {
              frequency: recurrence,
              frequency_type: "months",
              transaction_amount: amount,
              currency_id: "BRL",
            },
          },
          requestOptions: {
            idempotencyKey: randomUUID(),
          },
        });

        const status = String(created?.status || "").toLowerCase();
        if (["authorized", "active"].includes(status)) {
          await applyPaidPlan(admin, {
            userId: user.id,
            plano,
            mpCustomerId: created?.payer_id ? String(created.payer_id) : null,
            mpSubscriptionId: created?.id ? String(created.id) : null,
            mpPaymentId: null,
            mpPlanId: planId(plano, ciclo),
          });
        }

        return res.status(201).json({
          id: created?.id,
          subscription_id: created?.id ?? null,
          status: created?.status,
          plano,
          ciclo,
        });
      } catch (e) {
        logger.error("mercadopago create preference", { message: e instanceof Error ? e.message : "unknown" });
        return res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao criar pagamento." });
      }
    },
  );

  app.get(
    "/api/payments/status/:paymentId",
    paymentsLimiter,
    authSupabaseMiddleware({ optional: false }),
    async (req, res) => {
      const paymentId = String(req.params.paymentId || "").trim();
      if (!paymentId || paymentId.length > 120) return res.status(400).json({ error: "paymentId inválido" });

      try {
        const admin = supabaseAdmin();
        const client = mpClient();
        const paymentClient = new Payment(client);
        try {
          const payment = await paymentClient.get({ id: paymentId });
          await handlePaymentWebhook(admin, paymentClient, paymentId);
          return res.json({
            id: payment?.id,
            status: payment?.status,
            status_detail: payment?.status_detail,
          });
        } catch {
          const preApprovalClient = new PreApproval(client);
          const sub = await preApprovalClient.get({ id: paymentId });
          await handlePreApprovalWebhook(admin, preApprovalClient, paymentId);
          return res.json({
            id: sub?.id,
            status: sub?.status,
            subscription_id: sub?.id,
          });
        }
      } catch (e) {
        logger.error("mercadopago status", { message: e instanceof Error ? e.message : "unknown" });
        return res.status(500).json({ error: "Erro ao consultar pagamento." });
      }
    },
  );
}
