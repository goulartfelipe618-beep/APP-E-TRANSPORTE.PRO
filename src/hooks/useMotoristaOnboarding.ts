import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evaluateMotoristaOnboarding, type MotoristaOnboardingStatus } from "@/lib/motoristaOnboarding";

export function useMotoristaOnboarding(): MotoristaOnboardingStatus {
  const [state, setState] = useState<MotoristaOnboardingStatus>({
    loading: true,
    phase1Complete: false,
    networkChosen: false,
    pendencias: [],
  });

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState({ loading: false, phase1Complete: true, networkChosen: true, pendencias: [] });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const next = await evaluateMotoristaOnboarding(user.id);
      setState({ loading: false, ...next });
    } catch {
      setState({ loading: false, phase1Complete: false, networkChosen: false, pendencias: ["Erro ao verificar onboarding"] });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onCfg = () => void refresh();
    window.addEventListener("configuracoes-updated", onCfg);
    window.addEventListener("network-status-changed", onCfg);
    return () => {
      window.removeEventListener("configuracoes-updated", onCfg);
      window.removeEventListener("network-status-changed", onCfg);
    };
  }, [refresh]);

  return state;
}
