import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type DominioUsuarioRow = Tables<"dominios_usuario">;

/**
 * Domínios cadastrados pelo usuário em "Domínios" (para escolha no Website / E-mail Business).
 */
export function usePurchasedDomains(enabled: boolean) {
  const [domains, setDomains] = useState<DominioUsuarioRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDomains([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("dominios_usuario")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pendente", "ativo", "em_configuracao"])
      .order("fqdn", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar seus domínios.", { description: error.message });
      setDomains([]);
    } else {
      setDomains((data as DominioUsuarioRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  return { domains, loading, refetch: load };
}
