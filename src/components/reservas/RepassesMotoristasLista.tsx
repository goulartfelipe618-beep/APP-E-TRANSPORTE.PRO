import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveMotoristaNome } from "@/lib/motoristaReservaAssign";
import { listReservaMotoristasExtraComRepasse, type ReservaKind } from "@/lib/reservaMotoristasExtra";

type Linha = { nome: string; papel: string; repasse: string };

function dinheiro(valor: number | null): string {
  if (valor == null || valor <= 0) return "sem repasse";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RepassesMotoristasLista({
  kind,
  reservaId,
  userId,
  primaryId,
  repassePrincipal,
  ocultarValores = false,
}: {
  kind: ReservaKind;
  reservaId: string;
  userId: string;
  primaryId: string | null;
  repassePrincipal: number | null;
  ocultarValores?: boolean;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const extras = await listReservaMotoristasExtraComRepasse(kind, reservaId);
      const ids = [...new Set([primaryId, ...extras.map((item) => item.motoristaId)].map((id) => (id ?? "").trim()).filter(Boolean))];
      const { data } = await supabase
        .from("solicitacoes_motoristas")
        .select("id, nome, portal_auth_user_id")
        .eq("user_id", userId);
      const lista = (data ?? []) as { id: string; nome: string; portal_auth_user_id: string | null }[];
      const principal = (primaryId ?? "").trim();
      const saida: Linha[] = [];
      if (principal) {
        const nome = resolveMotoristaNome(principal, lista);
        if (nome !== "—") saida.push({ nome, papel: "Principal", repasse: ocultarValores ? "—" : dinheiro(repassePrincipal) });
      }
      for (const extra of extras) {
        if (extra.motoristaId === principal) continue;
        const nome = resolveMotoristaNome(extra.motoristaId, lista);
        if (nome === "—") continue;
        saida.push({ nome, papel: "Extra", repasse: ocultarValores ? "—" : dinheiro(extra.repasse) });
      }
      if (!cancel) setLinhas(saida);
    })();
    return () => {
      cancel = true;
    };
  }, [kind, reservaId, userId, primaryId, repassePrincipal, ocultarValores]);

  if (linhas.length === 0) return null;

  return (
    <ul className="space-y-2">
      {linhas.map((linha) => (
        <li key={`${linha.papel}:${linha.nome}`} className="flex items-start justify-between gap-3 text-sm">
          <span>
            <span className="font-medium text-foreground">{linha.nome}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{linha.papel}</span>
          </span>
          <span className="shrink-0 text-right">{linha.repasse}</span>
        </li>
      ))}
    </ul>
  );
}
