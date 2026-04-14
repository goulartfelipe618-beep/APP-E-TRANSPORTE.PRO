import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Flag na linha `comunicadores_evolution` (escopo sistema): admin controla se o menu/página
 * Comunicador aparece para motoristas executivos.
 */
export function usePainelMotoristaEvolutionAtivo() {
  const [ativo, setAtivo] = useState(true);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("comunicadores_evolution")
      .select("painel_motorista_evolution_ativo")
      .eq("escopo", "sistema")
      .maybeSingle();

    if (error || data == null) {
      setAtivo(true);
    } else {
      setAtivo(data.painel_motorista_evolution_ativo !== false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onEvt = () => void reload();
    window.addEventListener("painel-motorista-evolution-changed", onEvt);
    return () => window.removeEventListener("painel-motorista-evolution-changed", onEvt);
  }, [reload]);

  return { painelMotoristaEvolutionAtivo: ativo, ready, reload };
}
