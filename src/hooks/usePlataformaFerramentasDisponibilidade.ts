import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlataformaFerramentasFlags = {
  google_maps_consumo_liberado: boolean;
  disparador_consumo_liberado: boolean;
};

const DEFAULT_FLAGS: PlataformaFerramentasFlags = {
  google_maps_consumo_liberado: false,
  disparador_consumo_liberado: false,
};

export function usePlataformaFerramentasDisponibilidade() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<PlataformaFerramentasFlags>(DEFAULT_FLAGS);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plataforma_ferramentas_disponibilidade")
        .select("google_maps_consumo_liberado, disparador_consumo_liberado")
        .eq("id", 1)
        .maybeSingle();

      if (error || !data) {
        setFlags(DEFAULT_FLAGS);
        return;
      }
      const row = data;
      setFlags({
        google_maps_consumo_liberado: !!row.google_maps_consumo_liberado,
        disparador_consumo_liberado: !!row.disparador_consumo_liberado,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { loading, flags, refetch };
}
