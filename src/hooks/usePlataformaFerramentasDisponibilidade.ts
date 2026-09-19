import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlataformaFerramentasFlags = {
  marketing_menu_liberado: boolean;
};

/** Use com `invalidateQueries` após alterar flags no admin. */
export const PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY = [
  "plataforma-ferramentas-disponibilidade",
] as const;

const DEFAULT_FLAGS: PlataformaFerramentasFlags = {
  marketing_menu_liberado: false,
};

async function fetchPlataformaFerramentasDisponibilidade(): Promise<PlataformaFerramentasFlags> {
  const { data, error } = await supabase
    .from("plataforma_ferramentas_disponibilidade")
    .select("marketing_menu_liberado")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return { ...DEFAULT_FLAGS };
  }
  const row = data as {
    marketing_menu_liberado?: boolean;
  };
  return {
    marketing_menu_liberado: !!row.marketing_menu_liberado,
  };
}

/**
 * Flags globais de menus da plataforma. Sem cache persistente entre montagens
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
    marketing_menu_liberado: query.data?.marketing_menu_liberado ?? false,
  };

  return {
    loading,
    flags,
    refetch: query.refetch,
  };
}
