import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  normalizeBillingCycle,
  resolvePriceId,
} from "../_shared/stripePlanPrices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID = ["standart", "pro"] as const;

const checkoutBodySchema = z.object({
  plano: z.preprocess(
    (v) => String(v ?? "").toLowerCase().trim(),
    z.enum(PAID),
  ),
  ciclo: z.string().min(1).max(64),
});

/** Garante placeholder Stripe para correlacionar o retorno ao Checkout Session (recomendado pela Stripe). */
function withCheckoutSessionIdInSuccessUrl(successUrl: string): string {
  const u = successUrl.trim();
  if (!u) return u;
  if (u.includes("{CHECKOUT_SESSION_ID}")) return u;
  const join = u.includes("?") ? "&" : "?";
  return `${u}${join}session_id={CHECKOUT_SESSION_ID}`;
}

function normalizePlano(raw: string | null | undefined): "free" | "standart" | "pro" {
  if (!raw) return "free";
  const p = String(raw).toLowerCase().trim();
  if (p === "free") return "free";
  if (p === "standart" || p === "standard") return "standart";
  if (p === "pro" || ["seed", "grow", "rise", "apex", "premium"].includes(p)) return "pro";
  return "free";
}

async function stripeCheckoutSessionCreate(form: Record<string, string>): Promise<{ url: string }> {
  const secret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY em falta");
  const body = new URLSearchParams(form);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error?.message === "string" ? data.error.message : JSON.stringify(data);
    throw new Error(msg);
  }
  if (typeof data.url !== "string" || !data.url) {
    throw new Error("Stripe não devolveu URL de checkout");
  }
  return { url: data.url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
    const roleList = (roles || []).map((r: { role: string }) => r.role);
    if (roleList.includes("admin_master")) {
      return new Response(JSON.stringify({ error: "Conta administrativa não utiliza pagamento Stripe." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!roleList.includes("admin_transfer")) {
      return new Response(JSON.stringify({ error: "Apenas motoristas executivos podem subscrever." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = checkoutBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Pedido inválido. Envie plano (standart | pro) e ciclo de faturação." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const plano = parsed.data.plano;

    const cicloRaw = normalizeBillingCycle(parsed.data.ciclo);
    if (!cicloRaw) {
      return new Response(
        JSON.stringify({
          error: "Ciclo de faturação inválido. Utilize monthly, quarterly, semiannual ou annual.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const ciclo = cicloRaw;

    const baseSuccessUrl = Deno.env.get("STRIPE_CHECKOUT_SUCCESS_URL")?.trim() ?? "";
    const successUrl = withCheckoutSessionIdInSuccessUrl(baseSuccessUrl);
    const cancelUrl = Deno.env.get("STRIPE_CHECKOUT_CANCEL_URL")?.trim();
    if (!baseSuccessUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({
          error: "Pagamentos não configurados no servidor (URLs de retorno STRIPE_CHECKOUT_*).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const priceId = resolvePriceId(plano, ciclo);
    if (!priceId) {
      const planKey = plano === "pro" ? "PRO" : "STANDART";
      const cycleKey =
        ciclo === "monthly"
          ? "MONTHLY"
          : ciclo === "quarterly"
            ? "QUARTERLY"
            : ciclo === "semiannual"
              ? "SEMIANNUAL"
              : "YEARLY";
      return new Response(
        JSON.stringify({
          error: `Preço Stripe em falta para ${plano} (${ciclo}). Defina STRIPE_PRICE_${planKey}_${cycleKey} nos secrets do Supabase (mensal: STRIPE_PRICE_STANDART / STRIPE_PRICE_PRO ainda aceites como legado).`,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: planRow } = await supabaseAdmin
      .from("user_plans")
      .select("plano, billing_manual_override, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (planRow?.billing_manual_override === true) {
      return new Response(
        JSON.stringify({
          error:
            "O plano desta conta está bloqueado pelo administrador. Contacte o suporte para alterações ou para permitir cobrança Stripe.",
        }),
        { status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const current = normalizePlano(planRow?.plano as string | undefined);
    if (current === "pro") {
      return new Response(JSON.stringify({ error: "A sua conta já está no plano PRÓ." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (current === "standart" && plano !== "pro") {
      return new Response(
        JSON.stringify({ error: "Com plano STANDART, só pode subscrever o upgrade para PRÓ." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const form: Record<string, string> = {
      mode: "subscription",
      /** Obrigatório quando o Dashboard não tem métodos activos para BRL / subscrição. */
      "payment_method_types[0]": "card",
      locale: "pt-BR",
      "success_url": successUrl,
      "cancel_url": cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      "metadata[supabase_user_id]": user.id,
      "metadata[plano_target]": plano,
      "metadata[billing_cycle]": ciclo,
      "subscription_data[metadata][supabase_user_id]": user.id,
      "subscription_data[metadata][plano_target]": plano,
      "subscription_data[metadata][billing_cycle]": ciclo,
    };

    const cust = typeof planRow?.stripe_customer_id === "string" ? planRow.stripe_customer_id.trim() : "";
    if (cust) {
      form.customer = cust;
    } else if (user.email) {
      form.customer_email = user.email;
    }

    const { url } = await stripeCheckoutSessionCreate(form);

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
