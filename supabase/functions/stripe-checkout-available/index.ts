import { stripeMonthlyCheckoutConfigured } from "../_shared/stripePlanPrices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GET público (anon): indica se o checkout Stripe está configurado no projeto.
 * Usado pelo painel para mostrar «Subscrever» sem depender de VITE_STRIPE_BILLING_ENABLED.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const successUrl = Deno.env.get("STRIPE_CHECKOUT_SUCCESS_URL")?.trim();
  const cancelUrl = Deno.env.get("STRIPE_CHECKOUT_CANCEL_URL")?.trim();
  const urlsOk = !!(successUrl && cancelUrl);
  const monthlyOk = stripeMonthlyCheckoutConfigured();
  const available = urlsOk && monthlyOk;

  return new Response(JSON.stringify({ available }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
