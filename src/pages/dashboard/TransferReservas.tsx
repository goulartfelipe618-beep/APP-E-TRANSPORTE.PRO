import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, Eye, MessageSquare, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CriarReservaTransferDialog from "@/components/transfer/CriarReservaTransferDialog";
import DetalhesReservaTransferSheet from "@/components/reservas/DetalhesReservaTransferSheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateTransferPDF } from "@/lib/pdfGenerator";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { Tables } from "@/integrations/supabase/types";

type Reserva = Tables<"reservas_transfer">;

const tipoLabel: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

export default function TransferReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reserva | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<Reserva | null>(null);

  const fetchReservas = useCallback(async () => {
    const { data, error } = await supabase
      .from("reservas_transfer")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar reservas");
    else setReservas(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchReservas(); }, [fetchReservas]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reservas_transfer").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Reserva excluída"); fetchReservas(); }
  };

  const handleComunicar = (r: Reserva) => {
    const phone = r.telefone?.replace(/\D/g, "");
    if (phone) window.open(`https://wa.me/${phone}`, "_blank");
    else toast.info("Telefone não disponível");
  };

  const handleDownload = async (r: Reserva) => {
    toast.info("Gerando PDF...");
    await generateTransferPDF(r.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
          <p className="text-muted-foreground">Reservas convertidas a partir de solicitações ({reservas.length})</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReservas}><RefreshCw className="h-4 w-4" /></Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar Reserva
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Nenhuma reserva encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Trajeto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">#{r.numero_reserva}</TableCell>
                  <TableCell className="font-medium">{r.nome_completo}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.telefone}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{tipoLabel[r.tipo_viagem] || r.tipo_viagem}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {r.ida_embarque && r.ida_desembarque ? `${r.ida_embarque} → ${r.ida_desembarque}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.ida_data ? new Date(r.ida_data).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="font-semibold">{Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(r); setSheetOpen(true); }} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleComunicar(r)} title="Comunicar">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(r)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CriarReservaTransferDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchReservas} />

      <DetalhesReservaTransferSheet
        reserva={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComunicar={handleComunicar}
        onDownload={handleDownload}
      />
    </div>
  );
}
