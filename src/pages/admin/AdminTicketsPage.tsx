import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Ticket, AlertCircle, Clock, CheckCircle, MessageSquare } from "lucide-react";

interface TicketRow {
  id: string;
  codigo_ticket: number;
  tipo: string;
  assunto: string;
  descricao: string;
  status: string;
  resposta_admin: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  motorista_nome?: string;
}

const STATUS_OPTIONS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "respondido", label: "Respondido" },
  { value: "fechado", label: "Fechado" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberto: { label: "Aberto", variant: "destructive" },
  em_andamento: { label: "Em Andamento", variant: "default" },
  respondido: { label: "Respondido", variant: "secondary" },
  fechado: { label: "Fechado", variant: "outline" },
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [resposta, setResposta] = useState("");
  const [novoStatus, setNovoStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("tickets" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const baseTickets = data as unknown as TicketRow[];
      const userIds = [...new Set(baseTickets.map((ticket) => ticket.user_id))];

      let nomeByUserId: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: nomesData } = await supabase
          .from("configuracoes" as any)
          .select("user_id, nome_completo")
          .in("user_id", userIds);

        nomeByUserId = (nomesData || []).reduce((acc: Record<string, string>, row: any) => {
          acc[row.user_id] = row.nome_completo || "Motorista sem nome";
          return acc;
        }, {});
      }

      const withDriverName = baseTickets.map((ticket) => ({
        ...ticket,
        motorista_nome: nomeByUserId[ticket.user_id] || "Motorista sem nome",
      }));

      setTickets(withDriverName);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const openTicket = (t: TicketRow) => {
    setSelected(t);
    setResposta(t.resposta_admin || "");
    setNovoStatus(t.status);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("tickets" as any)
      .update({ status: novoStatus, resposta_admin: resposta.trim(), updated_at: new Date().toISOString() } as any)
      .eq("id", selected.id);
    if (error) {
      toast.error("Erro ao atualizar ticket");
    } else {
      toast.success("Ticket atualizado!");
      setSelected(null);
      fetchTickets();
    }
    setSaving(false);
  };

  const filtered = filtroStatus === "todos" ? tickets : tickets.filter(t => t.status === filtroStatus);
  const countByStatus = (s: string) => tickets.filter(t => t.status === s).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        <p className="text-muted-foreground text-sm">Gerencie solicitações dos motoristas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Abertos", value: countByStatus("aberto"), icon: AlertCircle, color: "text-destructive" },
          { label: "Em Andamento", value: countByStatus("em_andamento"), icon: Clock, color: "text-primary" },
          { label: "Respondidos", value: countByStatus("respondido"), icon: MessageSquare, color: "text-muted-foreground" },
          { label: "Fechados", value: countByStatus("fechado"), icon: CheckCircle, color: "text-muted-foreground" },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        {["todos", ...STATUS_OPTIONS.map(s => s.value)].map(s => (
          <Button
            key={s}
            size="sm"
            variant={filtroStatus === s ? "default" : "outline"}
            onClick={() => setFiltroStatus(s)}
            className="capitalize"
          >
            {s === "todos" ? "Todos" : STATUS_MAP[s]?.label || s}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Ticket className="h-12 w-12 mb-3 opacity-40" />
            <p>Nenhum ticket encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.aberto;
            return (
              <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openTicket(t)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{t.assunto}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">#{t.codigo_ticket}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{t.tipo}</Badge>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.descricao || "Sem descrição"}</p>
                  <p className="text-xs text-muted-foreground mt-2">Motorista: {t.motorista_nome || "Motorista sem nome"}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")} às {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.assunto}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Badge variant="outline">#{selected.codigo_ticket}</Badge>
                  <Badge variant="outline" className="capitalize">{selected.tipo}</Badge>
                  <Badge variant={STATUS_MAP[selected.status]?.variant || "default"}>
                    {STATUS_MAP[selected.status]?.label || selected.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Motorista</p>
                  <p className="text-sm text-muted-foreground">{selected.motorista_nome || "Motorista sem nome"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Descrição</p>
                  <p className="text-sm text-muted-foreground">{selected.descricao || "Sem descrição"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Alterar Status</p>
                  <Select value={novoStatus} onValueChange={setNovoStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Resposta</p>
                  <Textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={4} placeholder="Escreva uma resposta para o motorista..." />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
