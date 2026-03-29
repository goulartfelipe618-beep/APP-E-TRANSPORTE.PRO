import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import NovoReceptivoDialog from "@/components/receptivos/NovoReceptivoDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import type { Tables } from "@/integrations/supabase/types";
import {
  generateReceptivoTransferPdf,
  downloadReceptivoPdf,
  buildFooterPayloadFromReceptivoRow,
} from "@/lib/receptivoTransferPdf";

type Receptivo = Tables<"receptivos">;

export default function MarketingReceptivosPage() {
  const { config } = useConfiguracoes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rows, setRows] = useState<Receptivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("receptivos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar histórico de receptivos");
      setRows([]);
    } else {
      setRows((data as Receptivo[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const handleDownloadAgain = async (row: Receptivo) => {
    setDownloadingId(row.id);
    try {
      const footer = buildFooterPayloadFromReceptivoRow(row);
      const doc = await generateReceptivoTransferPdf(
        row.modelo,
        row.nome_cliente,
        config.nome_projeto || "E-Transporte.pro",
        config.logo_url || null,
        footer,
      );
      const stamp = new Date(row.created_at).toLocaleString("pt-BR").replace(/[/\\:]/g, "-");
      downloadReceptivoPdf(doc, `receptivo-${row.nome_cliente.slice(0, 20)}-${stamp}.pdf`);
      toast.success("Download iniciado");
    } catch (e) {
      toast.error("Falha ao gerar PDF");
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("receptivos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Registro removido");
    void fetchRows();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Receptivos</h1>
          <p className="text-muted-foreground">
            Plaquinhas em PDF (A4 paisagem) para identificação no embarque. Use reservas{" "}
            <strong className="text-foreground">Transfer</strong> para preencher endereços automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void fetchRows()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Receptivo
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Histórico</h3>
          <p className="text-sm text-muted-foreground">PDFs gerados ficam listados abaixo; você pode baixar novamente.</p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">Nenhum receptivo gerado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Reserva</TableHead>
                <TableHead>Embarque (resumo)</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>Modelo {r.modelo}</TableCell>
                  <TableCell className="font-medium">{r.nome_cliente}</TableCell>
                  <TableCell>
                    {r.reserva_numero != null ? (
                      <span>#{r.reserva_numero}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                    {r.embarque || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Baixar PDF novamente"
                        disabled={downloadingId === r.id}
                        onClick={() => void handleDownloadAgain(r)}
                      >
                        <Download className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir registro"
                        onClick={() => void handleDelete(r.id)}
                      >
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

      <NovoReceptivoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void fetchRows()}
      />
    </div>
  );
}
