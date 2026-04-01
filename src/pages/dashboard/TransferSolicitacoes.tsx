import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DetalhesSolicitacaoTransferSheet from "@/components/solicitacoes/DetalhesSolicitacaoTransferSheet";
import CriarReservaTransferDialog, { type TransferInitialData } from "@/components/transfer/CriarReservaTransferDialog";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { generateSolicitacaoTransferPDF } from "@/lib/pdfGenerator";
import { Tables } from "@/integrations/supabase/types";

type Solicitacao = Tables<"solicitacoes_transfer">;
export default function TransferSolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialData, setInitialData] = useState<TransferInitialData | null>(null);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<Solicitacao | null>(null);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("solicitacoes_transfer")
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
    const data: TransferInitialData = {
      nome_completo: s.nome_cliente,
      contato: s.contato || undefined,
      email: s.email || undefined,
      tipo: s.tipo || undefined,
      embarque: s.embarque || undefined,
      desembarque: s.desembarque || undefined,
      data_viagem: s.data_viagem || undefined,
      hora_viagem: s.hora_viagem || undefined,
      num_passageiros: s.num_passageiros,
      mensagem: s.mensagem || undefined,
      cupom: s.cupom || undefined,
      volta_embarque: s.volta_embarque || undefined,
      volta_desembarque: s.volta_desembarque || undefined,
      volta_data: s.volta_data || undefined,
      volta_hora: s.volta_hora || undefined,
      volta_passageiros: s.volta_passageiros || undefined,
      volta_mensagem: s.volta_mensagem || undefined,
      volta_cupom: s.volta_cupom || undefined,
      por_hora_endereco_inicio: s.por_hora_endereco_inicio || undefined,
      por_hora_ponto_encerramento: s.por_hora_ponto_encerramento || undefined,
      por_hora_data: s.por_hora_data || undefined,
      por_hora_hora: s.por_hora_hora || undefined,
      por_hora_passageiros: s.por_hora_passageiros || undefined,
      por_hora_qtd_horas: s.por_hora_qtd_horas || undefined,
      por_hora_cupom: s.por_hora_cupom || undefined,
      por_hora_itinerario: s.por_hora_itinerario || undefined,
      solicitacao_id: s.id,
    };
    setInitialData(data);
    setSheetOpen(false);
    setTimeout(() => setDialogOpen(true), 350);
  };

  const handleReservaCriada = async () => {
    // Mark solicitação as convertida
    if (initialData?.solicitacao_id) {
      await supabase.from("solicitacoes_transfer").update({ status: "convertida" }).eq("id", initialData.solicitacao_id);
    }
    setInitialData(null);
    fetchData();
  };

  const handleComunicar = (s: Solicitacao) => {
    setComunicarDados(s);
    setComunicarOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Transfer</h1>
          <p className="text-muted-foreground">Registros recebidos via webhook do site ({solicitacoes.length})</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Embarque</TableHead>
                <TableHead>Desembarque</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Passageiros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitacoes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome_cliente}</TableCell>
                  <TableCell className="text-sm">{s.contato || "—"}</TableCell>
                  <TableCell>{s.tipo ? <Badge variant="secondary">{s.tipo}</Badge> : "—"}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{s.embarque || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">{s.desembarque || "—"}</TableCell>
                  <TableCell className="text-sm">{s.data_viagem ? new Date(s.data_viagem).toLocaleDateString("pt-BR") : "—"}</TableCell>
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
        )}
      </div>

      <DetalhesSolicitacaoTransferSheet
        solicitacao={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConverter={handleConverter}
        onComunicar={handleComunicar}
      />

      <CriarReservaTransferDialog
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
          telefone={comunicarDados.contato}
          titulo="Comunicar — Solicitação Transfer"
          onGerarPDF={() => generateSolicitacaoTransferPDF(comunicarDados)}
          webhookTipo="transfer_solicitacao"
        />
      )}
    </div>
  );
}
