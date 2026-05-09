import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DetalhesSolicitacaoGrupoSheet from "@/components/solicitacoes/DetalhesSolicitacaoGrupoSheet";
import CriarReservaGrupoDialog, { type GrupoInitialData } from "@/components/grupos/CriarReservaGrupoDialog";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { generateSolicitacaoGrupoPDF } from "@/lib/pdfGenerator";
import { Tables } from "@/integrations/supabase/types";
import { SolicitacoesCapturaExternaInfo } from "@/components/solicitacoes/SolicitacoesCapturaExternaInfo";
import { formatDbCalendarDatePtBr } from "@/lib/painelAgendaReservas";
import { useUserPlan } from "@/hooks/useUserPlan";
import { minimumPlanForPage, pageAllowedForPlan } from "@/lib/painelPlanPolicy";
import PlanTierOpaqueGate from "@/components/planos/PlanTierOpaqueGate";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";

type Solicitacao = Tables<"solicitacoes_grupos">;
export default function GruposSolicitacoesPage() {
  const { plano, loading: planLoading } = useUserPlan();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialData, setInitialData] = useState<GrupoInitialData | null>(null);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<Solicitacao | null>(null);

  const { slice: solicitacoesPage, page, setPage, totalPages, totalItems } = usePainelListPagination(solicitacoes);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("solicitacoes_grupos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar solicitações");
    else setSolicitacoes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVisualizar = (s: Solicitacao) => {
    setSelected(s);
    setSheetOpen(true);
  };

  const handleConverter = (s: Solicitacao) => {
    const data: GrupoInitialData = {
      nome_cliente: s.nome_cliente,
      whatsapp: s.whatsapp || undefined,
      email: s.email || undefined,
      tipo_veiculo: s.tipo_veiculo || undefined,
      embarque: s.embarque || undefined,
      destino: s.destino || undefined,
      data_ida: s.data_ida || undefined,
      hora_ida: s.hora_ida || undefined,
      data_retorno: s.data_retorno || undefined,
      hora_retorno: s.hora_retorno || undefined,
      num_passageiros: s.num_passageiros,
      mensagem: s.mensagem || undefined,
      cupom: s.cupom || undefined,
      solicitacao_id: s.id,
    };
    setInitialData(data);
    setSheetOpen(false);
    setTimeout(() => setDialogOpen(true), 350);
  };

  const handleReservaCriada = async () => {
    if (initialData?.solicitacao_id) {
      await supabase.from("solicitacoes_grupos").update({ status: "convertida" }).eq("id", initialData.solicitacao_id);
    }
    setInitialData(null);
    fetchData();
  };

  const handleComunicar = (s: Solicitacao) => {
    setComunicarDados(s);
    setComunicarOpen(true);
  };

  if (planLoading) {
    return <div className="flex justify-center py-20 text-sm text-muted-foreground">A carregar…</div>;
  }

  return (
    <PlanTierOpaqueGate
      minimumPlan={minimumPlanForPage("grupos/solicitacoes")}
      blocked={!pageAllowedForPlan(plano, "grupos/solicitacoes")}
      title="Solicitações — Grupos (visualização)"
      description="Pedidos e orçamentos de transporte em grupo, com conversão em reservas."
    >
    <div className="space-y-6">
      <SolicitacoesCapturaExternaInfo />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Grupos</h1>
          <p className="text-muted-foreground">Registros recebidos via webhook ({totalItems})</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : solicitacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma solicitação recebida.</p>
        ) : (
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Data Ida</TableHead>
                  <TableHead>Passageiros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoesPage.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome_cliente}</TableCell>
                    <TableCell className="text-sm">{s.whatsapp || "—"}</TableCell>
                    <TableCell>{s.tipo_veiculo ? <Badge variant="secondary">{s.tipo_veiculo}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{s.embarque || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{s.destino || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDbCalendarDatePtBr(s.data_ida)}</TableCell>
                    <TableCell>{s.num_passageiros ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleVisualizar(s)} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleComunicar(s)} title="Comunicar">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-4 pb-4">
              <PainelPaginationBar page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      <DetalhesSolicitacaoGrupoSheet
        solicitacao={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConverter={handleConverter}
        onComunicar={handleComunicar}
      />

      <CriarReservaGrupoDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setInitialData(null); }}
        onCreated={handleReservaCriada}
        initialData={initialData}
      />

      {comunicarDados && (
        <ComunicarDialog
          open={comunicarOpen}
          onOpenChange={setComunicarOpen}
          dados={comunicarDados}
          telefone={comunicarDados.whatsapp}
          titulo="Comunicar — Solicitação de Grupo"
          onGerarPDF={() => generateSolicitacaoGrupoPDF(comunicarDados)}
          webhookTipo="grupo_solicitacao"
        />
      )}
    </div>
    </PlanTierOpaqueGate>
  );
}
