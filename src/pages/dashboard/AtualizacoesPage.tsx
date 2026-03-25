import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Tables } from "@/integrations/supabase/types";

type SolicitacaoTransfer = Tables<"solicitacoes_transfer">;
type SolicitacaoGrupo = Tables<"solicitacoes_grupos">;
type SolicitacaoMotorista = Tables<"solicitacoes_motoristas">;

type AtualizacaoItem = {
  id: string;
  origem: "transfer" | "grupos" | "motoristas";
  titulo: string;
  contato: string;
  status: string;
  createdAt: string;
  paginaDestino: string;
};

export default function AtualizacoesPage() {
  const { setActivePage } = useActivePage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AtualizacaoItem[]>([]);

  // [ATUALIZACOES-IMPLEMENTACAO]
  const fetchAtualizacoes = useCallback(async () => {
    setLoading(true);

    const [transferRes, gruposRes, motoristasRes] = await Promise.all([
      supabase.from("solicitacoes_transfer").select("*").order("created_at", { ascending: false }),
      supabase.from("solicitacoes_grupos").select("*").order("created_at", { ascending: false }),
      supabase.from("solicitacoes_motoristas").select("*").order("created_at", { ascending: false }),
    ]);

    if (transferRes.error || gruposRes.error || motoristasRes.error) {
      toast.error("Erro ao carregar atualizações");
      setLoading(false);
      return;
    }

    const transferItems: AtualizacaoItem[] = ((transferRes.data || []) as SolicitacaoTransfer[]).map((s) => ({
      id: s.id,
      origem: "transfer",
      titulo: s.nome_cliente,
      contato: s.contato || s.email || "—",
      status: s.status,
      createdAt: s.created_at,
      paginaDestino: "transfer/solicitacoes",
    }));

    const grupoItems: AtualizacaoItem[] = ((gruposRes.data || []) as SolicitacaoGrupo[]).map((s) => ({
      id: s.id,
      origem: "grupos",
      titulo: s.nome_cliente,
      contato: s.whatsapp || s.email || "—",
      status: s.status,
      createdAt: s.created_at,
      paginaDestino: "grupos/solicitacoes",
    }));

    const motoristaItems: AtualizacaoItem[] = ((motoristasRes.data || []) as SolicitacaoMotorista[]).map((s) => ({
      id: s.id,
      origem: "motoristas",
      titulo: s.nome,
      contato: s.telefone || s.email || "—",
      status: s.status,
      createdAt: s.created_at,
      paginaDestino: "motoristas/solicitacoes",
    }));

    const allItems = [...transferItems, ...grupoItems, ...motoristaItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setItems(allItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAtualizacoes();
  }, [fetchAtualizacoes]);

  const totalPorOrigem = useMemo(
    () => ({
      transfer: items.filter((item) => item.origem === "transfer").length,
      grupos: items.filter((item) => item.origem === "grupos").length,
      motoristas: items.filter((item) => item.origem === "motoristas").length,
    }),
    [items]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atualizações</h1>
          <p className="text-muted-foreground">
            Centraliza todas as solicitações recebidas em um único lugar ({items.length})
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchAtualizacoes} title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Transfer: {totalPorOrigem.transfer}</Badge>
        <Badge variant="outline">Grupos: {totalPorOrigem.grupos}</Badge>
        <Badge variant="outline">Motoristas: {totalPorOrigem.motoristas}</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma solicitação encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.origem}-${item.id}`}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {item.origem}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell className="text-sm">{item.contato}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(item.createdAt).toLocaleDateString("pt-BR")}{" "}
                    {new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setActivePage(item.paginaDestino)}>
                      Abrir página de origem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
