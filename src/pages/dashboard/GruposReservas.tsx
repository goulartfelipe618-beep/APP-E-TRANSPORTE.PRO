import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, Eye, MessageSquare, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CriarReservaGrupoDialog from "@/components/grupos/CriarReservaGrupoDialog";
import DetalhesReservaGrupoSheet from "@/components/reservas/DetalhesReservaGrupoSheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateGrupoPDF } from "@/lib/pdfGenerator";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { Tables } from "@/integrations/supabase/types";

type ReservaGrupo = Tables<"reservas_grupos">;

const veiculoLabel: Record<string, string> = {
  van: "Van",
  micro_onibus: "Micro-ônibus",
  onibus: "Ônibus",
};

export default function GruposReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservas, setReservas] = useState<ReservaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReservaGrupo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<ReservaGrupo | null>(null);

  const fetchReservas = useCallback(async () => {
    const { data, error } = await supabase
      .from("reservas_grupos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar reservas de grupos");
    else setReservas(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchReservas(); }, [fetchReservas]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reservas_grupos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Reserva excluída"); fetchReservas(); }
  };

  const handleComunicar = (r: ReservaGrupo) => {
    setComunicarDados(r);
    setComunicarOpen(true);
  };

  const handleDownload = async (r: ReservaGrupo) => {
    toast.info("Gerando PDF...");
    await generateGrupoPDF(r.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas de Grupos</h1>
          <p className="text-muted-foreground">Reservas convertidas a partir de solicitações de grupos ({reservas.length})</p>
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
                <TableHead>Veículo</TableHead>
                <TableHead>Passageiros</TableHead>
                <TableHead>Trajeto</TableHead>
                <TableHead>Data Ida</TableHead>
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
                    <div className="text-sm">{r.whatsapp}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{r.tipo_veiculo ? <Badge variant="secondary">{veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo}</Badge> : "—"}</TableCell>
                  <TableCell>{r.num_passageiros ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.data_ida ? new Date(r.data_ida).toLocaleDateString("pt-BR") : "—"}</TableCell>
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

      <CriarReservaGrupoDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchReservas} />

      <DetalhesReservaGrupoSheet
        reserva={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComunicar={handleComunicar}
        onDownload={handleDownload}
      />

      {comunicarDados && (
        <ComunicarDialog
          open={comunicarOpen}
          onOpenChange={setComunicarOpen}
          dados={comunicarDados}
          telefone={comunicarDados.whatsapp}
          titulo="Comunicar — Reserva de Grupo"
          onGerarPDF={() => generateGrupoPDF(comunicarDados.id)}
          origemMotoristaWebhook="grupo_reserva"
        />
      )}
    </div>
  );
}
