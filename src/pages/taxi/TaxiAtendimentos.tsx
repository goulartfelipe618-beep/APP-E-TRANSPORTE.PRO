import { useState, useEffect } from "react";
import { CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Atendimento {
  id: string;
  nome_cliente: string;
  telefone: string;
  origem: string | null;
  destino: string | null;
  data_corrida: string | null;
  hora_corrida: string | null;
  qtd_passageiros: number | null;
  observacoes: string | null;
  status: string;
  numero_atendimento: number;
  created_at: string;
  updated_at: string;
}

export default function TaxiAtendimentos() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhes, setDetalhes] = useState<Atendimento | null>(null);

  const fetchAtendimentos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("chamadas_taxi")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "aceito")
      .order("updated_at", { ascending: false });
    setAtendimentos((data as Atendimento[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAtendimentos(); }, []);

  const handleConcluir = async (a: Atendimento) => {
    const { error } = await supabase
      .from("chamadas_taxi")
      .update({ status: "concluido", updated_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) { toast.error("Erro ao concluir"); return; }
    toast.success(`Atendimento #${a.numero_atendimento} concluído!`);
    setDetalhes(null);
    fetchAtendimentos();
  };

  const statusBadge = (s: string) => {
    if (s === "aceito") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Em andamento</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
      </div>
      <p className="text-muted-foreground">Chamadas aceitas que estão em atendimento.</p>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem → Destino</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : atendimentos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum atendimento em andamento.</TableCell></TableRow>
            ) : atendimentos.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-primary font-semibold">{a.numero_atendimento}</TableCell>
                <TableCell className="font-medium text-foreground">{a.nome_cliente}</TableCell>
                <TableCell className="text-muted-foreground">{a.telefone}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.origem || "—"} → {a.destino || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.data_corrida || "—"} {a.hora_corrida ? `às ${a.hora_corrida}` : ""}
                </TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetalhes(a)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleConcluir(a)}>
                      Concluir
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atendimento #{detalhes?.numero_atendimento}</DialogTitle>
          </DialogHeader>
          {detalhes && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="text-foreground font-medium">{detalhes.nome_cliente}</span></div>
              <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{detalhes.telefone}</span></div>
              <div><span className="text-muted-foreground">Origem:</span> <span className="text-foreground">{detalhes.origem || "—"}</span></div>
              <div><span className="text-muted-foreground">Destino:</span> <span className="text-foreground">{detalhes.destino || "—"}</span></div>
              <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{detalhes.data_corrida || "—"}</span></div>
              <div><span className="text-muted-foreground">Hora:</span> <span className="text-foreground">{detalhes.hora_corrida || "—"}</span></div>
              <div><span className="text-muted-foreground">Passageiros:</span> <span className="text-foreground">{detalhes.qtd_passageiros || 1}</span></div>
              {detalhes.observacoes && <div><span className="text-muted-foreground">Observações:</span> <span className="text-foreground">{detalhes.observacoes}</span></div>}
              <div className="pt-3">
                <Button className="w-full" onClick={() => handleConcluir(detalhes)}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Concluir Atendimento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
