export const BILLING_CYCLES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type StripeBillingCycle = (typeof BILLING_CYCLES)[number];

/** Rótulos do ciclo (alinhados ao checkout Stripe). */
export const BILLING_CYCLE_LABELS: Record<StripeBillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

/**
 * Valores exibidos no painel (BRL, duas casas) — espelho dos preços configurados na Stripe.
 * O valor cobrado é sempre o do Price ID na Stripe.
 */
export const PAID_PLAN_CYCLE_PRICES: Record<StripeBillingCycle, { standart: string; pro: string }> = {
  monthly: { standart: "R$ 89,90", pro: "R$ 109,90" },
  quarterly: { standart: "R$ 239,70", pro: "R$ 299,70" },
  semiannual: { standart: "R$ 419,40", pro: "R$ 539,40" },
  annual: { standart: "R$ 718,80", pro: "R$ 958,80" },
};
