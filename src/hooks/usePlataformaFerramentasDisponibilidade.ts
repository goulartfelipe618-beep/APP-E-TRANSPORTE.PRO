import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlataformaFerramentasFlags = {
  google_maps_consumo_liberado: boolean;
  disparador_consumo_liberado: boolean;
};

/** Use com `invalidateQueries` após alterar flags no admin. */
export const PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY = [
  "plataforma-ferramentas-disponibilidade",
] as const;

const DEFAULT_FLAGS: PlataformaFerramentasFlags = {
  google_maps_consumo_liberado: false,
  disparador_consumo_liberado: false,
};

async function fetchPlataformaFerramentasDisponibilidade(): Promise<PlataformaFerramentasFlags> {
  const { data, error } = await supabase
    .from("plataforma_ferramentas_disponibilidade")
    .select("google_maps_consumo_liberado, disparador_consumo_liberado")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return { ...DEFAULT_FLAGS };
  }
  return {
    google_maps_consumo_liberado: !!data.google_maps_consumo_liberado,
    disparador_consumo_liberado: !!data.disparador_consumo_liberado,
  };
}

/**
 * Flags globais de consumo (Google Maps / Disparador). Sem cache persistente entre montagens
 * (`gcTime: 0`), refetch ao focar a janela e ao montar — evita overlay de bloqueio antes da resposta.
 */
export function usePlataformaFerramentasDisponibilidade() {
  const [authHydrated, setAuthHydrated] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().finally(() => {
      setAuthHydrated(true);
    });
  }, []);

  const query = useQuery({
    queryKey: PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY,
    queryFn: fetchPlataformaFerramentasDisponibilidade,
    enabled: authHydrated,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const loading = !authHydrated || query.isPending;

  const flags: PlataformaFerramentasFlags = {
    google_maps_consumo_liberado: query.data?.google_maps_consumo_liberado ?? false,
    disparador_consumo_liberado: query.data?.disparador_consumo_liberado ?? false,
  };

  return {
    loading,
    flags,
    refetch: query.refetch,
  };
}
