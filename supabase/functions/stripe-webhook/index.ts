import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.6.0?target=deno";
import { priceIdToPlano } from "../_shared/stripePlanPrices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY em falta");
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function resolveUserIdForSubscription(
  admin: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const metaUid = sub.metadata?.supabase_user_id?.trim();
  if (metaUid) return metaUid;

  const { data: bySub } = await admin
    .from("user_plans")
    .select("user_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (bySub?.user_id) return bySub.user_id as string;

  const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!cust) return null;

  const { data: byCust } = await admin
    .from("user_plans")
    .select("user_id")
    .eq("stripe_customer_id", cust)
    .maybeSingle();
  return (byCust?.user_id as string) ?? null;
}

function firstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const pid = item?.price?.id;
  return typeof pid === "string" ? pid : null;
}

async function applyPaidPlan(
  admin: ReturnType<typeof createClient>,
  userId: string,
  plano: "standart" | "pro",
  stripeCustomerId: string,
  stripeSubscriptionId: string,
) {
  const { data: row } = await admin
    .from("user_plans")
    .select("billing_manual_override")
    .eq("user_id", userId)
    .maybeSingle();

  if (row?.billing_manual_override === true) {
    console.log("stripe webhook: skip user (billing_manual_override)", userId);
    return;
  }

  const { error } = await admin.from("user_plans").upsert(
    {
      user_id: userId,
      plano,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      billing_manual_override: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

async function applyFreeFromStripe(
  admin: ReturnType<typeof createClient>,
  userId: string,
  stripeCustomerId: string | null,
) {
  const { data: row } = await admin
    .from("user_plans")
    .select("billing_manual_override")
    .eq("user_id", userId)
    .maybeSingle();

  if (row?.billing_manual_override === true) {
    console.log("stripe webhook: skip downgrade (billing_manual_override)", userId);
    return;
  }

  const patch: Record<string, unknown> = {
    user_id: userId,
    plano: "free",
    stripe_subscription_id: null,
    billing_manual_override: false,
    updated_at: new Date().toISOString(),
  };
  if (stripeCustomerId) {
    patch.stripe_customer_id = stripeCustomerId;
  }

  const { error } = await admin.from("user_plans").upsert(patch, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

async function handleCheckoutCompleted(
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  if (session.mode !== "subscription") return;

  const userId =
    (session.metadata?.supabase_user_id?.trim() || session.client_reference_id?.trim()) ?? "";
  if (!userId) {
    console.error("checkout.session.completed sem supabase_user_id");
    return;
  }

  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const custId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subId || !custId) {
    console.error("checkout.session.completed sem subscription/customer");
    return;
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const priceId = firstPriceId(sub);
  if (!priceId) return;
  const plano = priceIdToPlano(priceId);
  if (!plano) {
    console.error("Preço Stripe não mapeado para plano:", priceId);
    return;
  }

  await applyPaidPlan(admin, userId, plano, custId, subId);

  await admin.from("solicitacoes_motoristas").delete().eq("lead_user_id", userId);
}

async function handleSubscriptionUpdated(admin: ReturnType<typeof createClient>, sub: Stripe.Subscription) {
  const userId = await resolveUserIdForSubscription(admin, sub);
  if (!userId) {
    console.error("subscription.updated sem user_id", sub.id);
    return;
  }

  const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";

  const activeLike = new Set(["active", "trialing", "past_due"]);
  const endLike = new Set(["canceled", "unpaid", "incomplete_expired", "paused"]);
  const st = sub.status as string;

  if (activeLike.has(st)) {
    const priceId = firstPriceId(sub);
    if (!priceId) return;
    const plano = priceIdToPlano(priceId);
    if (!plano) return;
    await applyPaidPlan(admin, userId, plano, cust, sub.id);
    return;
  }

  if (st === "incomplete") {
    return;
  }

  if (endLike.has(st)) {
    await applyFreeFromStripe(admin, userId, cust || null);
  }
}

async function handleSubscriptionDeleted(admin: ReturnType<typeof createClient>, sub: Stripe.Subscription) {
  const userId = await resolveUserIdForSubscription(admin, sub);
  if (!userId) return;
  const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  await applyFreeFromStripe(admin, userId, cust);
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

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET em falta" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Assinatura em falta" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    const stripe = stripeClient();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "verify failed";
    console.error("stripe webhook verify:", msg);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { error: insErr } = await admin.from("stripe_webhook_events").insert({ id: event.id });
  if (insErr) {
    const dup =
      insErr.code === "23505" ||
      String(insErr.message || "").toLowerCase().includes("duplicate") ||
      String(insErr.message || "").toLowerCase().includes("unique");
    if (dup) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("stripe_webhook_events insert:", insErr.message);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = stripeClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(admin, stripe, session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(admin, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(admin, sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "handler error";
    console.error("stripe webhook handler:", msg);
    await admin.from("stripe_webhook_events").delete().eq("id", event.id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
