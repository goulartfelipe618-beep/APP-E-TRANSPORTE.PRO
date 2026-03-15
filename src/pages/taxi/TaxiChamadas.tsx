import { useState, useEffect } from "react";
import { Phone, Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Chamada {
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
}

export default function TaxiChamadas() {
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhes, setDetalhes] = useState<Chamada | null>(null);

  const fetchChamadas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("chamadas_taxi")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setChamadas((data as Chamada[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchChamadas(); }, []);

  const handleAceitar = async (chamada: Chamada) => {
    const { error } = await supabase
      .from("chamadas_taxi")
      .update({ status: "aceito", updated_at: new Date().toISOString() })
      .eq("id", chamada.id);
    if (error) { toast.error("Erro ao aceitar chamada"); return; }
    toast.success(`Chamada #${chamada.numero_atendimento} aceita! Movida para Atendimentos.`);
    setDetalhes(null);
    fetchChamadas();
  };

  const handleRecusar = async (chamada: Chamada) => {
    const { error } = await supabase
      .from("chamadas_taxi")
      .update({ status: "recusado", updated_at: new Date().toISOString() })
      .eq("id", chamada.id);
    if (error) { toast.error("Erro ao recusar chamada"); return; }
    toast.success("Chamada recusada.");
    setDetalhes(null);
    fetchChamadas();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Chamadas</h1>
      </div>
      <p className="text-muted-foreground">Solicitações de corrida pendentes. Aceite para mover para Atendimentos.</p>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Passageiros</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : chamadas.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma chamada pendente no momento.</TableCell></TableRow>
            ) : chamadas.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-primary font-semibold">{c.numero_atendimento}</TableCell>
                <TableCell className="font-medium text-foreground">{c.nome_cliente}</TableCell>
                <TableCell className="text-muted-foreground">{c.telefone}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.origem || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.destino || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {c.data_corrida || "—"} {c.hora_corrida ? `às ${c.hora_corrida}` : ""}
                </TableCell>
                <TableCell className="text-center">{c.qtd_passageiros || 1}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetalhes(c)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={() => handleAceitar(c)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRecusar(c)}>
                      <X className="h-4 w-4" />
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
            <DialogTitle>Chamada #{detalhes?.numero_atendimento}</DialogTitle>
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
              <div className="flex gap-2 pt-3">
                <Button className="flex-1" onClick={() => handleAceitar(detalhes)}>
                  <Check className="h-4 w-4 mr-2" /> Aceitar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleRecusar(detalhes)}>
                  <X className="h-4 w-4 mr-2" /> Recusar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
