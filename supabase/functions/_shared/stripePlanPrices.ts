export const BILLING_CYCLES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

const ENV_STANDART: Record<BillingCycle, string> = {
  monthly: "STRIPE_PRICE_STANDART_MONTHLY",
  quarterly: "STRIPE_PRICE_STANDART_QUARTERLY",
  semiannual: "STRIPE_PRICE_STANDART_SEMIANNUAL",
  annual: "STRIPE_PRICE_STANDART_YEARLY",
};

const ENV_PRO: Record<BillingCycle, string> = {
  monthly: "STRIPE_PRICE_PRO_MONTHLY",
  quarterly: "STRIPE_PRICE_PRO_QUARTERLY",
  semiannual: "STRIPE_PRICE_PRO_SEMIANNUAL",
  annual: "STRIPE_PRICE_PRO_YEARLY",
};

function getEnvTrimmed(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function legacyStandMonthly(): string {
  return getEnvTrimmed("STRIPE_PRICE_STANDART");
}

function legacyProMonthly(): string {
  return getEnvTrimmed("STRIPE_PRICE_PRO");
}

/** Resolve Stripe Price ID for plan + ciclo. Mensal aceita secrets legados `STRIPE_PRICE_STANDART` / `STRIPE_PRICE_PRO`. */
export function resolvePriceId(plano: "standart" | "pro", cycle: BillingCycle): string {
  const envName = plano === "pro" ? ENV_PRO[cycle] : ENV_STANDART[cycle];
  let id = getEnvTrimmed(envName);
  if (!id && cycle === "monthly") {
    id = plano === "pro" ? legacyProMonthly() : legacyStandMonthly();
  }
  return id;
}

export function priceIdToPlano(priceId: string): "standart" | "pro" | null {
  if (!priceId) return null;
  for (const cycle of BILLING_CYCLES) {
    const s = resolvePriceId("standart", cycle);
    if (s && priceId === s) return "standart";
  }
  for (const cycle of BILLING_CYCLES) {
    const p = resolvePriceId("pro", cycle);
    if (p && priceId === p) return "pro";
  }
  return null;
}

/** Bloqueia `self-upgrade-plan` gratuito quando há checkout mensal configurado (incl. legado). */
export function stripeMonthlyCheckoutConfigured(): boolean {
  const key = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  if (!key) return false;
  return !!(resolvePriceId("standart", "monthly") && resolvePriceId("pro", "monthly"));
}

export function normalizeBillingCycle(raw: unknown): BillingCycle | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "monthly" || s === "month" || s === "mes" || s === "mês") return "monthly";
  if (s === "quarterly" || s === "quarter" || s === "trimestral" || s === "3months") return "quarterly";
  if (s === "semiannual" || s === "biannual" || s === "semestral" || s === "6months") return "semiannual";
  if (s === "annual" || s === "yearly" || s === "year" || s === "anual") return "annual";
  if ((BILLING_CYCLES as readonly string[]).includes(s)) return s as BillingCycle;
  return null;
}
