import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FinanceiroClienteOpt = { id: string; nome_exibicao: string };

/** Clientes cadastrados do operador (para filtros no menu Financeiro). */
export function useFinanceiroClientesOpts() {
  const [clientes, setClientes] = useState<FinanceiroClienteOpt[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (!cancelled) setClientes([]);
        return;
      }
      const { data } = await supabase
        .from("cadastro_clientes")
        .select("id, nome_exibicao")
        .eq("user_id", auth.user.id)
        .order("nome_exibicao", { ascending: true });
      if (!cancelled) {
        setClientes(
          (data ?? []).map((r) => ({
            id: String(r.id),
            nome_exibicao: String(r.nome_exibicao ?? "Cliente"),
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return clientes;
}

/** IDs de reservas transfer/grupo ligadas a um cliente (para filtrar lançamentos). */
export function useFinanceiroReservaIdsPorCliente(clienteId: string | null) {
  const [transferIds, setTransferIds] = useState<string[]>([]);
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setTransferIds([]);
      setGrupoIds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [t, g] = await Promise.all([
        supabase.from("reservas_transfer").select("id").eq("cadastro_cliente_id", clienteId),
        supabase.from("reservas_grupos").select("id").eq("cadastro_cliente_id", clienteId),
      ]);
      if (cancelled) return;
      setTransferIds((t.data ?? []).map((r: { id: string }) => r.id));
      setGrupoIds((g.data ?? []).map((r: { id: string }) => r.id));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const transferIdSet = useMemo(() => new Set(transferIds), [transferIds]);
  const grupoIdSet = useMemo(() => new Set(grupoIds), [grupoIds]);

  return { transferIds, grupoIds, transferIdSet, grupoIdSet, loading };
}
