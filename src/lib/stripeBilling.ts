import { supabase } from "@/integrations/supabase/client";
import type { StripeBillingCycle } from "@/lib/stripeBillingCycles";

/** Espelha a Edge: só ative em produção quando STRIPE_* estiver configurado no Supabase. */
export function isStripeBillingEnabled(): boolean {
  const v = String(import.meta.env.VITE_STRIPE_BILLING_ENABLED ?? "").toLowerCase().trim();
  return v === "true" || v === "1";
}

/**
 * Consulta a Edge `stripe-checkout-available` (sem JWT): true se STRIPE_SECRET_KEY,
 * preços mensais e URLs de retorno estão definidos no Supabase.
 */
export async function fetchStripeCheckoutConfigured(): Promise<boolean> {
  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!base || !anon) return false;
    const url = `${base.replace(/\/$/, "")}/functions/v1/stripe-checkout-available`;
    const res = await fetch(url, {
      method: "GET",
      headers: { apikey: anon },
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { available?: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

/**
 * Abre o Checkout Stripe (subscrição). Requer sessão e função `stripe-create-checkout-session` deployada.
 */
export async function startStripeSubscriptionCheckout(
  plano: "standart" | "pro",
  ciclo: StripeBillingCycle,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sessão inválida. Inicie sessão novamente.");
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-checkout-session`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plano, ciclo }),
  });

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Erro ${res.status}`);
  }
  if (typeof data.url !== "string" || !data.url) {
    throw new Error("Resposta inválida do servidor de pagamento.");
  }

  window.location.assign(data.url);
}
