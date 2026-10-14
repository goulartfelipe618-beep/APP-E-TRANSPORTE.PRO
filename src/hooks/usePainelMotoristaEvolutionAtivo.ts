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
    const { data, error } = await supabase.rpc("painel_motorista_evolution_ativo");
    if (!error && typeof data === "boolean") {
      setAtivo(data !== false);
    } else {
      setAtivo(true);
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
