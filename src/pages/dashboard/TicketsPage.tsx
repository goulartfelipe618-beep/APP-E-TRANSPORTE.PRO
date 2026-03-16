import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Ticket, Clock, CheckCircle, AlertCircle, MessageSquare } from "lucide-react";

interface TicketRow {
  id: string;
  tipo: string;
  assunto: string;
  descricao: string;
  status: string;
  resposta_admin: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const TIPO_OPTIONS = [
  { value: "melhoria", label: "Melhoria" },
  { value: "erro", label: "Erro / Bug" },
  { value: "duvida", label: "Dúvida" },
  { value: "sugestao", label: "Sugestão" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberto: { label: "Aberto", variant: "destructive" },
  em_andamento: { label: "Em Andamento", variant: "default" },
  respondido: { label: "Respondido", variant: "secondary" },
  fechado: { label: "Fechado", variant: "outline" },
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipo, setTipo] = useState("melhoria");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTickets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("tickets" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setTickets(data as unknown as TicketRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async () => {
    if (!assunto.trim()) { toast.error("Informe o assunto"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("tickets" as any).insert({
      user_id: user.id,
      tipo,
      assunto: assunto.trim(),
      descricao: descricao.trim(),
    } as any);

    if (error) {
      toast.error("Erro ao criar ticket");
    } else {
      toast.success("Ticket criado com sucesso!");
      setAssunto("");
      setDescricao("");
      setTipo("melhoria");
      setDialogOpen(false);
      fetchTickets();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-muted-foreground text-sm">Relate melhorias, erros ou dúvidas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Tipo</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Assunto *</label>
                <Input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Resumo do problema ou sugestão" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Descrição</label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva com detalhes..." rows={4} />
              </div>
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Enviando..." : "Enviar Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Ticket className="h-12 w-12 mb-3 opacity-40" />
            <p>Nenhum ticket criado ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.aberto;
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {t.status === "aberto" && <AlertCircle className="h-4 w-4 text-destructive" />}
                      {t.status === "em_andamento" && <Clock className="h-4 w-4 text-primary" />}
                      {t.status === "respondido" && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                      {t.status === "fechado" && <CheckCircle className="h-4 w-4 text-muted-foreground" />}
                      <CardTitle className="text-base">{t.assunto}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{t.tipo}</Badge>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {t.descricao && <p className="text-sm text-muted-foreground">{t.descricao}</p>}
                  {t.resposta_admin && (
                    <div className="bg-muted rounded-lg p-3 mt-2">
                      <p className="text-xs font-semibold text-foreground mb-1">Resposta do Administrador:</p>
                      <p className="text-sm text-muted-foreground">{t.resposta_admin}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Criado em {new Date(t.created_at).toLocaleDateString("pt-BR")} às {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
