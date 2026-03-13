import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DetalhesSolicitacaoTransferSheet from "@/components/solicitacoes/DetalhesSolicitacaoTransferSheet";
import CriarReservaTransferDialog, { type TransferInitialData } from "@/components/transfer/CriarReservaTransferDialog";

interface Solicitacao {
  id: string;
  nome_cliente: string;
  contato: string | null;
  tipo: string | null;
  embarque: string | null;
  desembarque: string | null;
  data_viagem: string | null;
  num_passageiros: number | null;
  mensagem: string | null;
  status: string;
  created_at: string;
}

export default function TransferSolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialData, setInitialData] = useState<TransferInitialData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
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

  const handleConverter = async (s: Solicitacao) => {
    // Close the details sheet and open the reservation dialog pre-filled
    setSheetOpen(false);
    setInitialData({
      nome_completo: s.nome_cliente,
      contato: s.contato || undefined,
      tipo: s.tipo || undefined,
      embarque: s.embarque || undefined,
      desembarque: s.desembarque || undefined,
      data_viagem: s.data_viagem || undefined,
      num_passageiros: s.num_passageiros,
      mensagem: s.mensagem || undefined,
      solicitacao_id: s.id,
    });
    setDialogOpen(true);
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
    const phone = s.contato?.replace(/\D/g, "");
    if (phone) window.open(`https://wa.me/${phone}`, "_blank");
    else toast.info("Contato não disponível");
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
    </div>
  );
}
