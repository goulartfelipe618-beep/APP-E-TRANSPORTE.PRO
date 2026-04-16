import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanType = "free" | "pro";

export const PLAN_ORDER: PlanType[] = ["free", "pro"];

/** Único plano pago (PRÓ) — usado no admin ao finalizar leads e criar utilizadores. */
export const PLANS_PAID_ORDER: PlanType[] = ["pro"];

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "FREE",
  pro: "PRÓ",
};

export const PLAN_COLORS: Record<PlanType, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
};

const LEGACY_PAID = new Set(["seed", "grow", "rise", "apex"]);

/** Normaliza valores em `user_plans` (inclui legado seed/grow/rise/apex → pro). */
export function normalizeUserPlano(raw: string | null | undefined): PlanType {
  if (!raw) return "free";
  const p = String(raw).toLowerCase().trim();
  if (p === "free") return "free";
  if (p === "pro") return "pro";
  if (LEGACY_PAID.has(p)) return "pro";
  return "free";
}

export function useUserPlan() {
  const [plano, setPlano] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPlano("free");
      setLoading(false);
      return;
    }
    const { data } = await supabase.from("user_plans").select("plano").eq("user_id", user.id).maybeSingle();
    setPlano(normalizeUserPlano(data?.plano));
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  /** `free` — qualquer utilizador; `pro` — apenas plano PRÓ. */
  const hasPlan = (required: PlanType) => {
    if (required === "free") return true;
    if (required === "pro") return plano === "pro";
    return false;
  };

  return { plano, loading, hasPlan, refetch };
}
