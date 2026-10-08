import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type ComunicadorRow = Tables<"comunicadores_evolution">;

const COMUNICADOR_COLS =
  "id, escopo, user_id, rotulo, instance_name, qr_code_base64, connection_status, telefone_conectado, created_at, updated_at, nome_dispositivo, foto_perfil_url, painel_motorista_evolution_ativo, inbox_sessao_conectado_em";

export const INSTANCE_SISTEMA_DEFAULT = "etp-sistema-oficial";

export function instanceNameForUser(userId: string) {
  return `etp-u-${userId.replace(/-/g, "").slice(0, 16)}`;
}

export function qrSrc(qr: string | null): string | null {
  if (!qr) return null;
  if (qr.startsWith("data:")) return qr;
  return `data:image/png;base64,${qr}`;
}

export function useComunicadoresEvolution(opts?: { includeUsuarioComunicador?: boolean }) {
  const includeUsuario = opts?.includeUsuarioComunicador !== false;

  const [sistema, setSistema] = useState<ComunicadorRow | null>(null);
  const [own, setOwn] = useState<ComunicadorRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSistema(null);
      setOwn(null);
      setLoading(false);
      return;
    }

    if (!includeUsuario) {
      const sysRes = await supabase.from("comunicadores_evolution").select(COMUNICADOR_COLS).eq("escopo", "sistema").maybeSingle();
      setSistema(sysRes.data ?? null);
      setOwn(null);
      setLoading(false);
      return;
    }

    const [sysRes, ownRes] = await Promise.all([
      supabase.from("comunicadores_evolution").select(COMUNICADOR_COLS).eq("escopo", "sistema").maybeSingle(),
      supabase.from("comunicadores_evolution").select(COMUNICADOR_COLS).eq("escopo", "usuario").eq("user_id", user.id).maybeSingle(),
    ]);

    setSistema(sysRes.data ?? null);
    setOwn(ownRes.data ?? null);
    setLoading(false);
  }, [includeUsuario]);

  useEffect(() => {
    void load();
  }, [load]);

  return { sistema, own, loading, reload: load, setSistema, setOwn };
}
