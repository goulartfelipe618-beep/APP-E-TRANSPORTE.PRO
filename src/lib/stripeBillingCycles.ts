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

/** Meses por ciclo (totais em PAID_PLAN_CYCLE_TOTALS_BRL alinhados a PAID_PLAN_CYCLE_PRICES). */
const CYCLE_MONTHS: Record<StripeBillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Totais em BRL por ciclo — espelho dos valores em `PAID_PLAN_CYCLE_PRICES`. */
export const PAID_PLAN_CYCLE_TOTALS_BRL: Record<StripeBillingCycle, { standart: number; pro: number }> = {
  monthly: { standart: 89.9, pro: 109.9 },
  quarterly: { standart: 239.7, pro: 299.7 },
  semiannual: { standart: 419.4, pro: 539.4 },
  annual: { standart: 718.8, pro: 958.8 },
};

/** Formata valor para UI tipo `89,90` (sem prefixo). */
export function formatBrlParts(n: number): string {
  return n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Equivalente mensal, percentagem de poupança vs. mensal (por plano) e total do período. */
export function getBillingCycleDisplay(cycle: StripeBillingCycle): {
  months: number;
  standartPerMonth: number;
  proPerMonth: number;
  standartSavePercent: number | null;
  proSavePercent: number | null;
  standartTotalFormatted: string;
  proTotalFormatted: string;
} {
  const months = CYCLE_MONTHS[cycle];
  const t = PAID_PLAN_CYCLE_TOTALS_BRL[cycle];
  const base = PAID_PLAN_CYCLE_TOTALS_BRL.monthly;
  const standartPerMonth = t.standart / months;
  const proPerMonth = t.pro / months;
  const standartSavePercent =
    cycle === "monthly" ? null : Math.max(0, Math.round((1 - standartPerMonth / base.standart) * 100));
  const proSavePercent =
    cycle === "monthly" ? null : Math.max(0, Math.round((1 - proPerMonth / base.pro) * 100));
  return {
    months,
    standartPerMonth,
    proPerMonth,
    standartSavePercent,
    proSavePercent,
    standartTotalFormatted: formatBrlParts(t.standart),
    proTotalFormatted: formatBrlParts(t.pro),
  };
}
