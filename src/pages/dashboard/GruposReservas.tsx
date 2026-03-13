import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CriarReservaGrupoDialog from "@/components/grupos/CriarReservaGrupoDialog";
import { Badge } from "@/components/ui/badge";

interface ReservaGrupo {
  id: string;
  nome_completo: string;
  email: string;
  whatsapp: string;
  tipo_veiculo: string | null;
  num_passageiros: number | null;
  embarque: string | null;
  destino: string | null;
  data_ida: string | null;
  valor_total: number;
  status: string;
  created_at: string;
}

const veiculoLabel: Record<string, string> = {
  van: "Van",
  micro_onibus: "Micro-ônibus",
  onibus: "Ônibus",
};

export default function GruposReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservas, setReservas] = useState<ReservaGrupo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservas_grupos")
      .select("id, nome_completo, email, whatsapp, tipo_veiculo, num_passageiros, embarque, destino, data_ida, valor_total, status, created_at")
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas de Grupos</h1>
          <p className="text-muted-foreground">Reservas convertidas a partir de solicitações de grupos</p>
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
                    {r.tipo_veiculo && <Badge variant="secondary">{veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo}</Badge>}
                    {r.num_passageiros && <Badge variant="outline">{r.num_passageiros} passageiros</Badge>}
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "Sem trajeto definido"}
                    {r.data_ida && ` • ${new Date(r.data_ida).toLocaleDateString("pt-BR")}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.email} • {r.whatsapp}</p>
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

      <CriarReservaGrupoDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchReservas} />
    </div>
  );
}
