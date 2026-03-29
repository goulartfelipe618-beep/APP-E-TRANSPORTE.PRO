import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlanType = "free" | "seed" | "grow" | "rise" | "apex";

export const PLAN_ORDER: PlanType[] = ["free", "seed", "grow", "rise", "apex"];

/** Planos pagos na ordem exibida ao criar motorista/taxista no admin */
export const PLANS_PAID_ORDER: PlanType[] = ["seed", "grow", "rise", "apex"];

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "FREE",
  seed: "Seed",
  grow: "Grow",
  rise: "Rise",
  apex: "Apex",
};

export const PLAN_COLORS: Record<PlanType, string> = {
  free: "bg-muted text-muted-foreground",
  seed: "bg-green-500/10 text-green-600 border-green-500/30",
  grow: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  rise: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  apex: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

export function useUserPlan() {
  const [plano, setPlano] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPlano("free");
      setLoading(false);
      return;
    }
    const { data } = await (supabase.from("user_plans" as any).select("plano").eq("user_id", user.id).maybeSingle() as any);
    if (data?.plano) setPlano(data.plano as PlanType);
    else setPlano("free");
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  const hasPlan = (required: PlanType) => {
    return PLAN_ORDER.indexOf(plano) >= PLAN_ORDER.indexOf(required);
  };

  return { plano, loading, hasPlan, refetch };
}
