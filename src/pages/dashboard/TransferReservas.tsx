import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CriarReservaTransferDialog from "@/components/transfer/CriarReservaTransferDialog";
import { Badge } from "@/components/ui/badge";

interface Reserva {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string;
  tipo_viagem: string;
  valor_total: number;
  status: string;
  created_at: string;
  ida_embarque: string | null;
  ida_desembarque: string | null;
  ida_data: string | null;
}

const tipoLabel: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

export default function TransferReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservas_transfer")
      .select("id, nome_completo, email, telefone, tipo_viagem, valor_total, status, created_at, ida_embarque, ida_desembarque, ida_data")
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
          <p className="text-muted-foreground">Reservas convertidas a partir de solicitações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReservas}><RefreshCw className="h-4 w-4" /></Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar Reserva
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Reservas Ativas ({reservas.length})</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : reservas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva encontrada.</p>
        ) : (
          <div className="space-y-3">
            {reservas.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.nome_completo}</span>
                    <Badge variant="secondary">{tipoLabel[r.tipo_viagem] || r.tipo_viagem}</Badge>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.ida_embarque && r.ida_desembarque ? `${r.ida_embarque} → ${r.ida_desembarque}` : "Sem trajeto definido"}
                    {r.ida_data && ` • ${new Date(r.ida_data).toLocaleDateString("pt-BR")}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.email} • {r.telefone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">
                    {Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CriarReservaTransferDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchReservas} />
    </div>
  );
}
