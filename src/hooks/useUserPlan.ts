import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeUserPlano as normalizePlano,
  planMeetsMinimum,
  type PlanType,
} from "@/lib/painelPlanPolicy";
import { USER_PLAN_REFETCH_EVENT } from "@/lib/userPlanRefetch";
import {
  clearUserPlanCache,
  getUserPlanCache,
  isUserPlanCacheReadyFor,
  setUserPlanCache,
} from "@/lib/userPlanCache";

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

type Listener = () => void;
const listeners = new Set<Listener>();
let planChannel: ReturnType<typeof supabase.channel> | null = null;
let planChannelFor: string | null = null;
let planChannelUsers = 0;
let planChannelStarting = false;
let inflight: Promise<void> | null = null;

function emitPlanChange() {
  listeners.forEach((l) => l());
}

function subscribePlan(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCachedPlano(): PlanType {
  return getUserPlanCache()?.plano ?? "free";
}

function readCachedLoading(): boolean {
  return !getUserPlanCache();
}

async function fetchPlanIntoCache(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user?.id) {
      clearUserPlanCache();
      return;
    }
    const { data } = await supabase.from("user_plans").select("plano").eq("user_id", user.id).maybeSingle();
    setUserPlanCache(user.id, normalizePlano(data?.plano));
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useUserPlan() {
  const plano = useSyncExternalStore(subscribePlan, readCachedPlano, () => "free" as PlanType);
  const loading = useSyncExternalStore(subscribePlan, readCachedLoading, () => true);

  const refetch = useCallback(async () => {
    await fetchPlanIntoCache();
    emitPlanChange();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (cancelled) return;

      if (isUserPlanCacheReadyFor(user?.id)) {
        emitPlanChange();
        return;
      }

      await fetchPlanIntoCache();
      if (!cancelled) emitPlanChange();
    })();

    return () => {
      cancelled = true;
    };
  }, [refetch]);

  useEffect(() => {
    const onRefetch = () => {
      void refetch();
    };
    window.addEventListener(USER_PLAN_REFETCH_EVENT, onRefetch);
    return () => window.removeEventListener(USER_PLAN_REFETCH_EVENT, onRefetch);
  }, [refetch]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearUserPlanCache();
        emitPlanChange();
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void refetch();
      }
    });
    return () => subscription.unsubscribe();
  }, [refetch]);

  /** Uma inscrição só, mesmo com vários componentes a usar o plano. */
  useEffect(() => {
    let cancelled = false;
    planChannelUsers += 1;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (cancelled || !user?.id) return;
      if (planChannelStarting || (planChannel && planChannelFor === user.id)) return;
      planChannelStarting = true;
      if (planChannel) void supabase.removeChannel(planChannel);
      planChannelFor = user.id;
      const ch = supabase
        .channel(`user-plans-self-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_plans", filter: `user_id=eq.${user.id}` },
          () => {
            void fetchPlanIntoCache().then(() => emitPlanChange());
          },
        );
      if (cancelled) {
        planChannelStarting = false;
        return;
      }
      planChannel = ch;
      planChannelStarting = false;
      ch.subscribe();
    })();

    return () => {
      cancelled = true;
      planChannelUsers -= 1;
      if (planChannelUsers > 0) return;
      planChannelUsers = 0;
      if (planChannel) void supabase.removeChannel(planChannel);
      planChannel = null;
      planChannelFor = null;
    };
  }, []);

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
