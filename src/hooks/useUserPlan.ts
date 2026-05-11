import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeUserPlano as normalizePlano,
  planMeetsMinimum,
  type PlanType,
} from "@/lib/painelPlanPolicy";

export type { PlanType };

/**
 * Plano do utilizador (`user_plans.plano`). Alterar o plano não apaga dados —
 * apenas UI e permissões; ver README «Plano FREE e PRÓ (retenção de dados)».
 */
export const PLAN_ORDER: PlanType[] = ["free", "standart", "pro"];

/** Planos pagos (admin: finalizar lead, fluxos comerciais). */
export const PLANS_PAID_ORDER: PlanType[] = ["standart", "pro"];

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "FREE",
  standart: "STANDART",
  pro: "PRÓ",
};

export const PLAN_COLORS: Record<PlanType, string> = {
  free: "bg-muted text-muted-foreground",
  standart: "bg-sky-500/10 text-sky-800 border-sky-500/30 dark:text-sky-300",
  pro: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
};

export const PLAN_PRICE_LABELS: Record<PlanType, string> = {
  free: "R$ 0,00",
  standart: "R$ 89,90 / mês",
  pro: "R$ 109,90 / mês",
};

export function normalizeUserPlano(raw: string | null | undefined): PlanType {
  return normalizePlano(raw);
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
    setPlano(normalizePlano(data?.plano));
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const onRefetch = () => {
      void refetch();
    };
    window.addEventListener("etp-user-plan-refetch", onRefetch);
    return () => window.removeEventListener("etp-user-plan-refetch", onRefetch);
  }, [refetch]);

  /**
   * `hasPlan("free")` — sempre true.
   * `hasPlan("standart")` — STANDART ou PRÓ.
   * `hasPlan("pro")` — apenas PRÓ.
   */
  const hasPlan = (required: PlanType) => {
    if (required === "free") return true;
    return planMeetsMinimum(plano, required);
  };

  return { plano, loading, hasPlan, refetch };
}
